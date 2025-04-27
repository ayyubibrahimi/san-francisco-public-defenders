import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/base/card';
import { Button } from '@/components/ui/base/button';
import { Badge } from '@/components/ui/base/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/base/tabs';
import { 
  ArrowLeft, Shield, User, FileText, Search, 
  ChevronDown, ChevronUp, ExternalLink, AlertCircle,
  FileDigit, Layers
} from 'lucide-react';
import { Case } from '../../types/case';
import { createClient } from '@supabase/supabase-js';
import _ from 'lodash';

interface CaseProfileProps {
  case: Case | null;
  onBack: () => void;
  onOfficerSelect: (uid: string) => void;
  searchTerm?: string;
}

interface DocumentMatch {
  sha1: string;
  title: string;
  source: string;
  date: string;
  pdfUrl?: string;
  summary?: string | null; 
  matches: Array<{
    pageNumber: number;
    text: string;
    context: string;
  }>;
  fullDocument?: Array<{
    pageNumber: number;
    content: string;
  }>;
  isExpanded: boolean;
  showSummary?: boolean; // Flag to toggle summary visibility
}

export const CaseProfile: React.FC<CaseProfileProps> = ({ 
  case: caseData, 
  onBack,
  onOfficerSelect,
  searchTerm = '' 
}) => {
  const [documentMatches, setDocumentMatches] = useState<DocumentMatch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('details');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initSupabase = useCallback(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials are not configured');
    }

    return createClient(supabaseUrl, supabaseKey);
  }, []);

  // Fetch summaries for the given SHA1 values
  const fetchSummaries = useCallback(async (sha1Values: string[]) => {
    if (!sha1Values.length) return {};
    
    try {
      const supabase = initSupabase();
      
      const { data: summaries, error } = await supabase
        .from('summaries')
        .select('sha1, summary_txt')
        .in('sha1', sha1Values);
      
      if (error) throw error;
      
      // Create a map of SHA1 to summary
      const summaryMap: Record<string, string> = {};
      if (summaries) {
        summaries.forEach(item => {
          summaryMap[item.sha1] = item.summary_txt;
        });
      }
      
      return summaryMap;
    } catch (err) {
      console.error('Error fetching summaries:', err);
      return {};
    }
  }, [initSupabase]);

  // Find all document matches related to this case and the current search term
  const fetchDocumentMatches = useCallback(async () => {
    if (!caseData) return;
    
    if (!searchTerm || searchTerm.length < 3) {
      setDocumentMatches([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const supabase = initSupabase();
      
      // Get all document metadata for this case
      const { data: caseDocuments, error: metadataError } = await supabase
        .from('document_metadata')
        .select('*')
        .eq('incident_id', caseData.incident_id);
      
      if (metadataError) throw metadataError;
      
      if (!caseDocuments || caseDocuments.length === 0) {
        setDocumentMatches([]);
        setIsLoading(false);
        return;
      }
      
      // Extract SHA1 identifiers from case documents
      const sha1Values = caseDocuments.map(doc => doc.sha1).filter(Boolean);
      
      if (sha1Values.length === 0) {
        setDocumentMatches([]);
        setIsLoading(false);
        return;
      }
      
      // Fetch summaries for these documents
      const summaryMap = await fetchSummaries(sha1Values);
      
      // Search all pages of these documents for the search term
      const searchPhrase = searchTerm.split(' ').map(word => `${word}:*`).join(' & ');
      
      const { data: searchResults, error: searchError } = await supabase
        .from('document_text')
        .select('*')
        .in('sha1', sha1Values)
        .textSearch('page_content', searchPhrase, {
          config: 'english',
          type: 'websearch',
        });
      
      if (searchError) throw searchError;
      
      if (!searchResults || searchResults.length === 0) {
        setDocumentMatches([]);
        setIsLoading(false);
        return;
      }
      
      // Group search results by SHA1
      const resultsByDocument = _.groupBy(searchResults, 'sha1');

      // Get PDF URLs from pdf_mappings table
      const { data: pdfMappings, error: pdfError } = await supabase
        .from('pdf_mappings')
        .select('sha1, url')
        .in('sha1', Object.keys(resultsByDocument));

      if (pdfError) throw pdfError;

      // Create a lookup map for PDF URLs
      const pdfUrlMap = new Map();
      if (pdfMappings) {
        pdfMappings.forEach(mapping => {
          pdfUrlMap.set(mapping.sha1, mapping.url);
        });
      }
      
      // Create document match objects
      const matches: DocumentMatch[] = Object.entries(resultsByDocument).map(([sha1, pages]) => {
        // Find metadata for this document
        const docMetadata = caseDocuments.find(doc => doc.sha1 === sha1);
        
        // Process match snippets
        const matchSnippets = pages.map(page => {
          const content = page.page_content || '';
          const lowerContent = content.toLowerCase();
          const lowerSearchTerm = searchTerm.toLowerCase();
          
          // Find index of search term in content
          const matchIndex = lowerContent.indexOf(lowerSearchTerm);
          
          if (matchIndex === -1) {
            // If exact match not found, try to find partial match
            const words = lowerContent.split(/\s+/);
            const termIndex = words.findIndex((word: string) => 
              word.includes(lowerSearchTerm)
            );
            
            if (termIndex === -1) {
              // Fallback - just show beginning of content
              return {
                pageNumber: page.page_number,
                text: content.substring(0, 150) + '...',
                context: content.substring(0, 50) + '...'
              };
            }
            
            // Create a context window around the partial match
            const start = Math.max(0, termIndex - 5);
            const end = Math.min(words.length, termIndex + 6);
            const originalWords = content.split(/\s+/);
            
            return {
              pageNumber: page.page_number,
              text: originalWords.slice(start, end).join(' ') + '...',
              context: originalWords.slice(Math.max(0, termIndex - 2), Math.min(words.length, termIndex + 3)).join(' ')
            };
          }
          
          // For exact matches, create snippet with surrounding context
          const snippetStart = Math.max(0, matchIndex - 100);
          const snippetEnd = Math.min(content.length, matchIndex + searchTerm.length + 100);
          const snippet = content.substring(snippetStart, snippetEnd);
          
          // Shorter context for display in list
          const contextStart = Math.max(0, matchIndex - 15);
          const contextEnd = Math.min(content.length, matchIndex + searchTerm.length + 15);
          const context = content.substring(contextStart, contextEnd);
          
          return {
            pageNumber: page.page_number,
            text: snippetStart > 0 ? '...' + snippet + '...' : snippet + '...',
            context: contextStart > 0 ? '...' + context + '...' : context + '...'
          };
        });
        
        return {
          sha1,
          title: docMetadata?.title || `Document ${sha1.substring(0, 8)}`,
          source: docMetadata?.source || 'Unknown source',
          date: docMetadata?.document_date || caseData.incident_date,
          pdfUrl: pdfUrlMap.get(sha1) || null,
          summary: summaryMap[sha1] || null, // Add summary
          matches: matchSnippets,
          isExpanded: false,
          showSummary: false
        };
      });
      
      setDocumentMatches(matches);
    } catch (err) {
      console.error('Error fetching document matches:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to search documents');
    } finally {
      setIsLoading(false);
    }
  }, [caseData, searchTerm, initSupabase, fetchSummaries]);

  useEffect(() => {
    // Reset whenever case changes
    if (caseData?.incident_id) {
      setActiveTab('officers');
      fetchDocumentMatches();
    }
  }, [caseData?.incident_id, searchTerm, fetchDocumentMatches, setActiveTab]);

  // Fetch all documents for this case
  const fetchAllCaseDocuments = useCallback(async () => {
    if (!caseData) return;
    
    setIsLoading(true);
    try {
      const supabase = initSupabase();
      
      // Get all document metadata for this case
      const { data: caseDocuments, error: metadataError } = await supabase
        .from('document_metadata')
        .select('*')
        .eq('incident_id', caseData.incident_id);
      
      if (metadataError) throw metadataError;
      
      if (!caseDocuments || caseDocuments.length === 0) {
        setDocumentMatches([]);
        setIsLoading(false);
        return;
      }

      // Add this line to deduplicate by sha1
      const uniqueCaseDocuments = _.uniqBy(caseDocuments, 'sha1');

      // Extract SHA1 identifiers from case documents
      const sha1Values = uniqueCaseDocuments.map(doc => doc.sha1).filter(Boolean);

        
      if (sha1Values.length === 0) {
        setDocumentMatches([]);
        setIsLoading(false);
        return;
      }

      // Fetch summaries for these documents
      const summaryMap = await fetchSummaries(sha1Values);

      // Get PDF URLs from pdf_mappings table
      const { data: pdfMappings, error: pdfError } = await supabase
        .from('pdf_mappings')
        .select('sha1, url')
        .in('sha1', sha1Values);

      if (pdfError) throw pdfError;

      // Create a lookup map for PDF URLs
      const pdfUrlMap = new Map();
      if (pdfMappings) {
        pdfMappings.forEach(mapping => {
          pdfUrlMap.set(mapping.sha1, mapping.url);
        });
      }

      // Create document objects for all documents
      // Create document objects for all documents
      const documents = uniqueCaseDocuments.map(doc => {
        return {
          sha1: doc.sha1,
          title: doc.title || `Document ${doc.sha1.substring(0, 8)}`,
          source: doc.source || 'Unknown source',
          date: doc.document_date || caseData.incident_date,
          pdfUrl: pdfUrlMap.get(doc.sha1) || null,
          summary: summaryMap[doc.sha1] || null, // Add summary
          matches: [],
          isExpanded: false,
          showSummary: false
        };
      });

      setDocumentMatches(documents);
    } catch (err) {
      console.error('Error fetching case documents:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setIsLoading(false);
    }
  }, [caseData, initSupabase, fetchSummaries]);

  const toggleDocument = (sha1: string) => {
    const docIndex = documentMatches.findIndex(doc => doc.sha1 === sha1);
    if (docIndex === -1) return;
    
    // Toggle expanded state
    setDocumentMatches(prevMatches => 
      prevMatches.map(match => 
        match.sha1 === sha1 
          ? { ...match, isExpanded: !match.isExpanded } 
          : match
      )
    );
  };

  // Toggle summary display
  const toggleSummary = (sha1: string) => {
    const docIndex = documentMatches.findIndex(doc => doc.sha1 === sha1);
    if (docIndex === -1) return;
    
    // Toggle summary visibility
    setDocumentMatches(prevMatches => 
      prevMatches.map(match => 
        match.sha1 === sha1 
          ? { ...match, showSummary: !match.showSummary } 
          : match
      )
    );
  };

  // Helper to highlight search terms in text
  const highlightSearchTerm = (text: string | null | undefined, term: string) => {
    // Add null/undefined check
    if (!text) return '';
    if (!term || term.length < 3) return text;
    
    try {
      const regex = new RegExp(`(${term})`, 'gi');
      const parts = text.split(regex);
      
      return parts.map((part, i) => 
        regex.test(part) 
          ? <span key={i} className="bg-yellow-200 font-medium">{part}</span> 
          : part
      );
    } catch (error) {
      console.error('Error highlighting text:', error);
      return text; // Return original text if highlighting fails
    }
  };

  if (!caseData) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <Button
          onClick={onBack}
          variant="ghost"
          className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Case List
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p>Case data not available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use lodash to get unique officers by uid
  const uniqueOfficers = _.uniqBy(caseData.officers, 'uid');

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <Button
        onClick={onBack}
        variant="ghost"
        className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Case List
      </Button>

      {errorMessage && (
        <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-muted rounded-lg">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold mb-1">
                    Case #{caseData.incident_id}
                  </h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{new Date(caseData.incident_date).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="capitalize">{caseData.incident_type}</span>
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="text-base px-4 py-1">
                {uniqueOfficers.length} Officer{uniqueOfficers.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="officers">Officers</TabsTrigger>
            <TabsTrigger value="documents">
              Documents
              {searchTerm && documentMatches.length > 0 && (
                <Badge className="ml-2 bg-yellow-100 text-yellow-800" variant="outline">
                  {documentMatches.reduce((acc, doc) => acc + doc.matches.length, 0)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="officers">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4">Officers Involved</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uniqueOfficers.map((officer) => (
                    <div
                      key={officer.uid}
                      className="p-4 rounded-lg bg-muted hover:bg-accent cursor-pointer"
                      onClick={() => onOfficerSelect(officer.uid)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-background rounded-lg">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium">{officer.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {officer.agency}
                            {officer.starNo && ` • Star #${officer.starNo}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Case Documents</h2>
                  
                  {searchTerm && documentMatches.length > 0 && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Search className="h-4 w-4 mr-1" />
                      Showing results for {searchTerm}
                    </div>
                  )}
                </div>
                
                {isLoading ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Searching documents...</p>
                  </div>
                ) : searchTerm && documentMatches.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p>No document matches found for {searchTerm}</p>
                    <p className="text-sm mt-2">Try a different search term or browse all case documents</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={fetchAllCaseDocuments}
                    >
                      View All Documents
                    </Button>
                  </div>
                ) : searchTerm ? (
                  // Show search results with match snippets
                  <div className="space-y-4">
                    {documentMatches.map((doc) => (
                      <div key={doc.sha1} className="border rounded-lg overflow-hidden">
                        <div className="p-4 bg-muted flex flex-col">
                          <div 
                            className="flex justify-between items-center cursor-pointer"
                            onClick={() => toggleDocument(doc.sha1)}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-primary" />
                              <div>
                                <h3 className="font-medium">{doc.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {doc.source} • {new Date(doc.date).toLocaleDateString()} • 
                                  <span className="ml-1 font-medium text-yellow-600">
                                    {doc.matches.length} match{doc.matches.length !== 1 ? 'es' : ''}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {doc.summary && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex items-center text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSummary(doc.sha1);
                                  }}
                                >
                                  <FileDigit className="h-4 w-4 mr-1" />
                                  {doc.showSummary ? 'Hide Summary' : 'Show Summary'}
                                </Button>
                              )}
                              {doc.isExpanded ? (
                                <ChevronUp className="h-5 w-5" />
                              ) : (
                                <ChevronDown className="h-5 w-5" />
                              )}
                            </div>
                          </div>
                          
                          {/* Summary section */}
                          {doc.summary && doc.showSummary && (
                            <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-100">
                              <div className="flex items-center mb-2 text-blue-800">
                                <Layers className="h-4 w-4 mr-1" />
                                <h4 className="font-medium text-sm">Document Summary</h4>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">
                                {searchTerm 
                                  ? highlightSearchTerm(doc.summary, searchTerm) 
                                  : doc.summary}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {doc.isExpanded ? (
                          // Show document info when expanded
                          <div className="p-4 border-t text-center bg-gray-50">
                            {doc.pdfUrl ? (
                              <div className="space-y-4">
                                <p className="text-muted-foreground">
                                  This document contains {doc.matches.length} match{doc.matches.length !== 1 ? 'es' : ''} for your search term.
                                </p>
                                <a 
                                  href={doc.pdfUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-10 px-4 py-2"
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Open Full Document
                                </a>
                                
                                {/* Pages with matches */}
                                <div className="mt-4 border rounded-md overflow-hidden">
                                  <div className="bg-muted p-3 text-sm font-medium">
                                    Pages with Matches:
                                  </div>
                                  <div className="divide-y">
                                    {doc.matches.map((match, idx) => (
                                      <div key={idx} className="p-3 hover:bg-gray-50">
                                        <div className="flex justify-between items-center">
                                          <div>
                                            <h4 className="font-medium">Page {match.pageNumber}</h4>
                                            <p className="text-sm text-muted-foreground">
                                              {highlightSearchTerm(match.context, searchTerm)}
                                            </p>
                                          </div>
                                          <a 
                                            href={`${doc.pdfUrl}#page=${match.pageNumber}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background h-9 px-3"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            View Page
                                          </a>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-muted-foreground">
                                PDF document not available for this document.
                              </p>
                            )}
                          </div>
                        ) : (
                          // Show match snippets when collapsed
                          <div className="border-t divide-y">
                            {doc.matches.slice(0, 2).map((match, index) => (
                              <div key={index} className="p-4 bg-yellow-50/50">
                                <div className="flex justify-between items-start">
                                  <p className="text-sm mb-1 text-muted-foreground">
                                    Page {match.pageNumber}
                                  </p>
                                  {doc.pdfUrl && (
                                    <a
                                      href={`${doc.pdfUrl}#page=${match.pageNumber}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 py-0 border-none bg-transparent text-primary hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Open Page
                                    </a>
                                  )}
                                </div>
                                <p className="whitespace-pre-wrap text-sm">
                                  {highlightSearchTerm(match.text, searchTerm)}
                                </p>
                              </div>
                            ))}
                            {doc.matches.length > 2 && (
                              <div className="p-2 text-center text-sm text-muted-foreground">
                                +{doc.matches.length - 2} more matches
                              </div>
                            )}
                            <div className="p-2 bg-muted">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full text-xs" 
                                onClick={() => toggleDocument(doc.sha1)}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View all matches
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  // No search term - show list of all documents or prompt to search
                  <div>
                    {documentMatches.length > 0 ? (
                      <div className="space-y-4">
                        {documentMatches.map((doc) => (
                          <div key={doc.sha1} className="border rounded-lg overflow-hidden">
                            <div className="p-4 bg-muted">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-primary" />
                                  <div>
                                    <h3 className="font-medium">{doc.title}</h3>
                                    <p className="text-sm text-muted-foreground">
                                      {doc.source} • {new Date(doc.date).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {doc.summary && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="flex items-center text-primary"
                                      onClick={() => toggleSummary(doc.sha1)}
                                    >
                                      <FileDigit className="h-4 w-4 mr-1" />
                                      {doc.showSummary ? 'Hide Summary' : 'Show Summary'}
                                    </Button>
                                  )}
                                  {doc.pdfUrl ? (
                                    <a 
                                      href={doc.pdfUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background h-9 px-3"
                                    >
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      Open Document
                                    </a>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                      PDF Not Available
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              {/* Summary section */}
                              {doc.summary && doc.showSummary && (
                                <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-100">
                                  <div className="flex items-center mb-2 text-blue-800">
                                    <Layers className="h-4 w-4 mr-1" />
                                    <h4 className="font-medium text-sm">Document Summary</h4>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{doc.summary}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p>Search for terms in the case list to see relevant document snippets</p>
                        <p className="text-sm mt-2">Or view all documents for this case</p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={fetchAllCaseDocuments}
                        >
                          View All Documents
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};