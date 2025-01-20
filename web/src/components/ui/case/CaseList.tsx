import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/base/input';
import { Card, CardContent } from '@/components/ui/base/card';
import { Badge } from '@/components/ui/base/badge';
import { Shield } from 'lucide-react';
import _ from 'lodash';
import { Case } from '../../types/case';
import { createClient } from '@supabase/supabase-js';

interface SearchMatch {
  text: string;
  pageNumber: number;
  sha1: string;
}

interface CaseListProps {
  onCaseSelect: (caseData: Case) => void;
}

export const CaseList: React.FC<CaseListProps> = ({ onCaseSelect }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textMatches, setTextMatches] = useState<Map<string, SearchMatch[]>>(new Map());

  const initSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials are not configured');
    }

    return createClient(supabaseUrl, supabaseKey);
  };

  const searchDocuments = async (term: string) => {
    if (!term || term.length < 3) {
      setTextMatches(new Map());
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const supabase = initSupabase();

      // Search in document_text table using full text search
      const { data: searchResults, error: searchError } = await supabase
        .from('document_text')
        .select('*')
        .textSearch('page_content', term, {
          config: 'english',
          type: 'plain'
        });

      if (searchError) throw searchError;

      if (!searchResults || searchResults.length === 0) {
        setTextMatches(new Map());
        setSearching(false);
        return;
      }

      // Get metadata for matching documents
      const uniqueSha1s = [...new Set(searchResults.map(r => r.sha1))];
      const { data: metadata, error: metadataError } = await supabase
        .from('document_metadata')
        .select('*')
        .in('sha1', uniqueSha1s);

      if (metadataError) throw metadataError;

      // Create a map of incident_id to search matches
      const matches = new Map<string, SearchMatch[]>();
      
      searchResults.forEach(result => {
        const doc = metadata?.find(m => m.sha1 === result.sha1);
        if (!doc) return;

        const content = result.page_content;
        const words = content.split(/\s+/);
        const termIndex = words.findIndex(word => 
          word.toLowerCase().includes(term.toLowerCase())
        );
        
        // Get context around the matching term (5 words before and after)
        const start = Math.max(0, termIndex - 5);
        const end = Math.min(words.length, termIndex + 6);
        const contextText = words.slice(start, end).join(' ') + '...';

        const match = {
          text: contextText,
          pageNumber: result.page_number,
          sha1: result.sha1
        };

        if (!matches.has(doc.incident_id)) {
          matches.set(doc.incident_id, []);
        }
        matches.get(doc.incident_id)?.push(match);
      });

      setTextMatches(matches);
    } catch (error) {
      console.error('Error in text search:', error);
      setError(error instanceof Error ? error.message : 'Failed to search documents');
    } finally {
      setSearching(false);
    }
  };

  // Debounce the search function
  const debouncedSearch = _.debounce(searchDocuments, 300);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const supabase = initSupabase();
        
        // Fetch all document metadata
        const { data: documents, error: fetchError } = await supabase
          .from('document_metadata')
          .select('*');

        if (fetchError) throw fetchError;

        // Group documents by incident_id to create cases
        const groupedCases = _.groupBy(documents, 'incident_id');
        const processedCases = Object.entries(groupedCases).map(([incident_id, incidents]) => ({
          incident_id,
          incident_type: incidents[0].incident_type,
          incident_date: incidents[0].incident_date,
          source: incidents[0].source,
          ois_details: incidents[0].ois_details,
          incident_details: incidents[0].incident_details,
          officers: incidents.map(inc => ({
            uid: inc.uid,
            name: inc.officer_name,
            starNo: inc.star_no,
            agency: inc.officer_agency
          }))
        }));

        setCases(processedCases);
      } catch (error) {
        console.error('Error loading initial data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load case data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      debouncedSearch(searchTerm);
    } else {
      setTextMatches(new Map());
    }
    return () => debouncedSearch.cancel();
  }, [searchTerm]);

  const getFilteredCases = () => {
    let filtered = cases;

    if (searchTerm) {
      // If we have text matches, prioritize those cases
      if (textMatches.size > 0) {
        filtered = cases.filter(c => 
          textMatches.has(c.incident_id) || 
          c.incident_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.incident_type.toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else {
        // Fall back to basic filtering if no text matches
        filtered = cases.filter(c =>
          c.incident_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.incident_type.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
    }

    return filtered;
  };

  const renderCase = (caseData: Case) => {
    const matches = textMatches.get(caseData.incident_id);

    return (
      <Card 
        key={caseData.incident_id}
        className="hover:bg-accent cursor-pointer transition-colors"
        onClick={() => onCaseSelect(caseData)}
      >
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-muted rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-semibold">Case #{caseData.incident_id}</h3>
                <Badge variant="secondary" className="capitalize">
                  {caseData.incident_type}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(caseData.incident_date).toLocaleDateString()}
              </p>
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">
                  {caseData.officers.length} Officer{caseData.officers.length !== 1 ? 's' : ''} Involved
                </p>
              </div>
              
              {matches && matches.length > 0 && (
                <div className="mt-3 space-y-2">
                  {matches.map((match, index) => (
                    <div key={index} className="text-sm bg-muted p-2 rounded">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Page {match.pageNumber}: </span>
                        {match.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return <div className="text-center p-4">Loading case data...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-600">Error: {error}</div>;
  }

  const filteredCases = getFilteredCases();

  return (
    <div>
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search cases by ID, type, or content..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
        {searching && (
          <p className="text-sm text-muted-foreground mt-2">
            Searching documents...
          </p>
        )}
        {searchTerm && !searching && (
          <p className="text-sm text-muted-foreground mt-2">
            Found {filteredCases.length} matching case{filteredCases.length !== 1 ? 's' : ''}
            {textMatches.size > 0 && ` with content matches`}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCases.map(renderCase)}
      </div>
    </div>
  );
};