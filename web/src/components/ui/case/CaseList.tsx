import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/base/input';
import { Badge } from '@/components/ui/base/badge';
import { Button } from '@/components/ui/base/button';
import { 
  Search, Calendar, MoreVertical, FileText, 
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, 
  Filter, X, 
} from 'lucide-react';
import _ from 'lodash';
import { Case } from '../../types/case';
import { createClient } from '@supabase/supabase-js';

interface SearchMatch {
  text: string;
  pageNumber: number;
  sha1: string;
}

interface CaseListProps {
  onCaseSelect: (caseData: Case, searchTerm?: string) => void;
}

export const CaseList: React.FC<CaseListProps> = ({ onCaseSelect }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textMatches, setTextMatches] = useState<Map<string, SearchMatch[]>>(new Map());
  
  // Filtering state
  const [filters, setFilters] = useState({
    incidentType: null as string | null,
    year: null as string | null,
    source: null as string | null,
  });
  
  // Filter UI state
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('incident_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const initSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials are not configured');
    }

    return createClient(supabaseUrl, supabaseKey);
  };

  const searchDocuments = async (term: string, retryCount = 0) => {
    if (!term || term.length < 3) {
      setTextMatches(new Map());
      setSearching(false);
      return;
    }
  
    setSearching(true);
    try {
      const supabase = initSupabase();
      const searchPhrase = term.split(' ').map(word => `${word}:*`).join(' & ');
  
      const { data: searchResults, error: searchError } = await supabase
        .from('document_text')
        .select('*')
        .textSearch('page_content', searchPhrase, {
          config: 'english',
          type: 'websearch',
        })
        .limit(50);
  
      if (searchError) {
        if (searchError.code === '57014' && retryCount < 2) {
          console.log(`Search timed out, retrying (attempt ${retryCount + 1})...`);
          setSearching(false);
          return searchDocuments(term, retryCount + 1);
        }
        throw searchError;
      }
  
      if (!searchResults || searchResults.length === 0) {
        setTextMatches(new Map());
        setSearching(false);
        return;
      }
  
      // Optimized metadata fetch
      const uniqueSha1s = [...new Set(searchResults.map(r => r.sha1))];
      const { data: metadata, error: metadataError } = await supabase
        .from('document_metadata')
        .select('incident_id,sha1')
        .in('sha1', uniqueSha1s)
        .limit(uniqueSha1s.length);
  
      if (metadataError) throw metadataError;
  
      // Create a map for faster lookups
      const metadataMap = new Map(
        metadata?.map(m => [m.sha1, m.incident_id]) ?? []
      );
  
      // Optimize matches creation
      const matches = new Map<string, SearchMatch[]>();
      searchResults.forEach(result => {
        const incidentId = metadataMap.get(result.sha1);
        if (!incidentId) return;
  
        const content = result.page_content;
        const words = content.split(/\s+/);
        const termIndex = words.findIndex((word: string) => 
          word.toLowerCase().includes(term.toLowerCase())
        );
        
        if (termIndex === -1) return; // Skip if term not found
  
        const start = Math.max(0, termIndex - 5);
        const end = Math.min(words.length, termIndex + 6);
        const contextText = words.slice(start, end).join(' ') + '...';
  
        const match = {
          text: contextText,
          pageNumber: result.page_number,
          sha1: result.sha1
        };
  
        if (!matches.has(incidentId)) {
          matches.set(incidentId, []);
        }
        matches.get(incidentId)?.push(match);
      });
  
      setTextMatches(matches);
    } catch (error) {
      console.error('Error in text search:', error);
      setError(error instanceof Error ? error.message : 'Failed to search documents');
    } finally {
      setSearching(false);
    }
  };

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
          incident_year: incidents[0].incident_year,
          receive_date: incidents[0].receive_date, // This could be an array
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

  const debouncedSearchRef = React.useRef<_.DebouncedFunc<typeof searchDocuments>>(
    _.debounce(searchDocuments, 300)
  );

  // Create memoized debounced search function
  const debouncedSearch = React.useMemo(() => {
    debouncedSearchRef.current?.cancel();
    debouncedSearchRef.current = _.debounce(searchDocuments, 300);
    return debouncedSearchRef.current;
  }, []);

  // Update search effect
  useEffect(() => {
    if (searchTerm) {
      debouncedSearch(searchTerm);
    } else {
      setTextMatches(new Map());
    }
    return () => {
      debouncedSearchRef.current?.cancel();
    };
  }, [searchTerm]);

  // Get unique incident types, years, sources
  const getIncidentTypes = () => {
    return _.uniq(cases.map(c => c.incident_type)).sort();
  };

  // Updated getYears function to use incident_year as the primary source
  const getYears = () => {
    const years = cases.map(c => {
      if (c.incident_year) return c.incident_year.toString();
      if (c.incident_date) {
        const date = new Date(c.incident_date);
        return !isNaN(date.getTime()) ? date.getFullYear().toString() : null;
      }
      return null;
    }).filter(Boolean) as string[];
    
    return _.uniq(years).sort((a, b) => parseInt(b) - parseInt(a));
  };

  const getSources = () => {
    return _.uniq(cases.map(c => c.source).filter(Boolean)) as string[];
  };

  const getFilteredCases = () => {
    let filtered = cases;

    // Apply search term filter
    if (searchTerm) {
      if (textMatches.size > 0) {
        filtered = filtered.filter(c => 
          textMatches.has(c.incident_id) || 
          c.incident_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.incident_type.toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else {
        filtered = filtered.filter(c =>
          c.incident_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.incident_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.source?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.officers.some(o => o.name?.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }
    }

    // Apply incident type filter
    if (filters.incidentType) {
      filtered = filtered.filter(c => c.incident_type === filters.incidentType);
    }

    // Updated year filter to use incident_year if available
    if (filters.year) {
      filtered = filtered.filter(c => {
        if (c.incident_year) {
          return c.incident_year.toString() === filters.year;
        } else if (c.incident_date) {
          const date = new Date(c.incident_date);
          return !isNaN(date.getTime()) ? date.getFullYear().toString() === filters.year : false;
        }
        return false;
      });
    }

    // Apply source filter
    if (filters.source) {
      filtered = filtered.filter(c => c.source === filters.source);
    }

    return filtered;
  };

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if field is already selected
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort and filter cases
  const getSortedAndFilteredCases = () => {
    const filtered = getFilteredCases();
    
    // Then sort by the selected field
    return _.orderBy(
      filtered,
      [sortField],
      [sortDirection]
    );
  };

  const filteredAndSortedCases = getSortedAndFilteredCases();

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedCases.length / itemsPerPage);
  const paginatedCases = filteredAndSortedCases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle page changes
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Updated formatDate function to handle invalid dates
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // New function to handle multiple receive dates
  const formatReceiveDates = (receiveDates: string[] | string | null) => {
    if (!receiveDates) return '';
    
    // Handle both single string and array of strings
    const dates = Array.isArray(receiveDates) ? receiveDates : [receiveDates];
    
    return dates
      .map(date => {
        const formattedDate = formatDate(date);
        return formattedDate || ''; // Use empty string if invalid
      })
      .filter(date => date !== '') // Filter out empty strings
      .join(', ');
  };

  // New function to format incident year
  const formatIncidentYear = (year: string | number | null) => {
    if (!year) return '';
    return String(year);
  };

  // Get incident type badge color
  const getIncidentTypeColor = (type: string) => {
    const typeMap: Record<string, string> = {
      'firearm': 'bg-red-100 text-red-800',
      'excessive force': 'bg-orange-100 text-orange-800',
      'dishonesty': 'bg-yellow-100 text-yellow-800',
      'sexual assault': 'bg-purple-100 text-purple-800',
      'in custody death': 'bg-gray-100 text-gray-800',
      'prejudice': 'bg-blue-100 text-blue-800',
      'discrimination': 'bg-blue-100 text-blue-800'
    };
    
    const lowerType = type.toLowerCase();
    for (const [key, value] of Object.entries(typeMap)) {
      if (lowerType.includes(key)) return value;
    }
    
    return 'bg-gray-100 text-gray-800';
  };

  // Render sort indicator
  const renderSortIndicator = (field: string) => {
    if (sortField !== field) return null;
    
    return sortDirection === 'asc' 
      ? <ChevronUp className="inline h-4 w-4" /> 
      : <ChevronDown className="inline h-4 w-4" />;
  };

  // Check if there are text matches for a case
  const hasTextMatches = (caseData: Case) => {
    return textMatches.has(caseData.incident_id) && textMatches.get(caseData.incident_id)!.length > 0;
  };

  // Get match snippet text for a case
  const getMatchSnippet = (caseData: Case) => {
    if (!hasTextMatches(caseData)) return null;
    return textMatches.get(caseData.incident_id)![0].text;
  };

  // Handle case selection with search context
  const handleCaseSelection = (caseData: Case) => {
    // Pass along the current search term to provide context for document display
    onCaseSelect(caseData, searchTerm);
  };

  // Toggle a filter dropdown
  const toggleFilterDropdown = (columnName: string) => {
    if (activeFilterDropdown === columnName) {
      setActiveFilterDropdown(null);
    } else {
      setActiveFilterDropdown(columnName);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      incidentType: null,
      year: null,
      source: null
    });
    setActiveFilterDropdown(null);
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return filters.incidentType !== null || 
           filters.year !== null || 
           filters.source !== null;
  };

  // Render filter dropdown for incident type
  const renderIncidentTypeFilter = () => {
    return (
      <div className="absolute z-10 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 p-2">
        <div className="max-h-60 overflow-y-auto">
          {getIncidentTypes().map(type => (
            <div 
              key={type} 
              className="flex items-center px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
              onClick={() => {
                setFilters({...filters, incidentType: filters.incidentType === type ? null : type});
              }}
            >
              <input
                type="checkbox"
                checked={filters.incidentType === type}
                onChange={() => {}}
                className="mr-2 h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700 capitalize">{type}</span>
              <span className="ml-auto text-xs text-gray-500">
                {cases.filter(c => c.incident_type === type).length}
              </span>
            </div>
          ))}
        </div>
        <div className="pt-2 mt-2 border-t border-gray-200">
          <button
            onClick={() => {
              setFilters({...filters, incidentType: null});
              setActiveFilterDropdown(null);
            }}
            className="text-xs text-red-600 hover:text-red-800 flex items-center"
          >
            <X className="h-3 w-3 mr-1" />
            Clear filter
          </button>
        </div>
      </div>
    );
  };

  // Render filter dropdown for year
  const renderYearFilter = () => {
    return (
      <div className="absolute z-10 mt-2 w-40 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 p-2">
        <div className="max-h-60 overflow-y-auto">
          {getYears().map(year => (
            <div 
              key={year} 
              className="flex items-center px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
              onClick={() => {
                setFilters({...filters, year: filters.year === year ? null : year});
              }}
            >
              <input
                type="checkbox"
                checked={filters.year === year}
                onChange={() => {}}
                className="mr-2 h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">{year}</span>
              <span className="ml-auto text-xs text-gray-500">
                {cases.filter(c => {
                  if (c.incident_year) return c.incident_year.toString() === year;
                  if (c.incident_date) {
                    const date = new Date(c.incident_date);
                    return !isNaN(date.getTime()) ? date.getFullYear().toString() === year : false;
                  }
                  return false;
                }).length}
              </span>
            </div>
          ))}
        </div>
        <div className="pt-2 mt-2 border-t border-gray-200">
          <button
            onClick={() => {
              setFilters({...filters, year: null});
              setActiveFilterDropdown(null);
            }}
            className="text-xs text-red-600 hover:text-red-800 flex items-center"
          >
            <X className="h-3 w-3 mr-1" />
            Clear filter
          </button>
        </div>
      </div>
    );
  };

  // Render filter dropdown for source
  const renderSourceFilter = () => {
    return (
      <div className="absolute z-10 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 p-2">
        <div className="max-h-60 overflow-y-auto">
          {getSources().map(source => (
            <div 
              key={source} 
              className="flex items-center px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
              onClick={() => {
                setFilters({...filters, source: filters.source === source ? null : source});
              }}
            >
              <input
                type="checkbox"
                checked={filters.source === source}
                onChange={() => {}}
                className="mr-2 h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">{source}</span>
              <span className="ml-auto text-xs text-gray-500">
                {cases.filter(c => c.source === source).length}
              </span>
            </div>
          ))}
        </div>
        <div className="pt-2 mt-2 border-t border-gray-200">
          <button
            onClick={() => {
              setFilters({...filters, source: null});
              setActiveFilterDropdown(null);
            }}
            className="text-xs text-red-600 hover:text-red-800 flex items-center"
          >
            <X className="h-3 w-3 mr-1" />
            Clear filter
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-gray-500">Loading case data...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-32 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="pt-6">
        <div className="mb-6">
          <p className="text-gray-500 text-sm">
            Browse and search through {cases.length} investigation cases
          </p>
        </div>
        
        <div className="relative mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Search cases by ID, type, content, or officer..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page on new search
              }}
              className="w-full pl-10"
            />
          </div>
          {searching && (
            <p className="text-xs text-gray-500 mt-1">
              Searching documents...
            </p>
          )}
          {searchTerm && !searching && (
            <p className="text-xs text-gray-500 mt-1">
              Found {getFilteredCases().length} matching case{getFilteredCases().length !== 1 ? 's' : ''}
              {textMatches.size > 0 && ` with content matches`}
            </p>
          )}
        </div>
        
        {/* Active Filters Display */}
        {hasActiveFilters() && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.incidentType && (
              <Badge 
                className="bg-blue-100 text-blue-800 flex items-center gap-1 pl-2 pr-1 py-1"
                variant="outline"
              >
                <span>Type: {filters.incidentType}</span>
                <button 
                  onClick={() => setFilters({...filters, incidentType: null})}
                  className="ml-1 p-0.5 hover:bg-blue-200 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filters.year && (
              <Badge 
                className="bg-green-100 text-green-800 flex items-center gap-1 pl-2 pr-1 py-1"
                variant="outline"
              >
                <span>Year: {filters.year}</span>
                <button 
                  onClick={() => setFilters({...filters, year: null})}
                  className="ml-1 p-0.5 hover:bg-green-200 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filters.source && (
              <Badge 
                className="bg-purple-100 text-purple-800 flex items-center gap-1 pl-2 pr-1 py-1"
                variant="outline"
              >
                <span>Source: {filters.source}</span>
                <button 
                  onClick={() => setFilters({...filters, source: null})}
                  className="ml-1 p-0.5 hover:bg-purple-200 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            <button 
              onClick={clearAllFilters}
              className="text-xs text-red-600 hover:text-red-800 flex items-center ml-2"
            >
              <X className="h-3 w-3 mr-1" />
              Clear all filters
            </button>
          </div>
        )}
        
        {/* Table View */}
        <div className="border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button 
                      className="flex items-center focus:outline-none" 
                      onClick={() => handleSort('incident_id')}
                    >
                      Case ID
                      {renderSortIndicator('incident_id')}
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center relative">
                      <button 
                        className="flex items-center focus:outline-none mr-2" 
                        onClick={() => handleSort('incident_type')}
                      >
                        Type
                        {renderSortIndicator('incident_type')}
                      </button>
                      
                      <button 
                        onClick={() => toggleFilterDropdown('incident_type')}
                        className={`p-1 rounded-md ${filters.incidentType ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}
                      >
                        <Filter className="h-3 w-3" />
                      </button>
                      
                      {activeFilterDropdown === 'incident_type' && renderIncidentTypeFilter()}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center relative">
                      <button 
                        className="flex items-center focus:outline-none mr-2" 
                        onClick={() => handleSort('incident_date')}
                      >
                        Incident Date
                        {renderSortIndicator('incident_date')}
                      </button>
                      
                      <button 
                        onClick={() => toggleFilterDropdown('year')}
                        className={`p-1 rounded-md ${filters.year ? 'bg-green-100 text-green-700' : 'hover:bg-gray-200'}`}
                      >
                        <Filter className="h-3 w-3" />
                      </button>
                      
                      {activeFilterDropdown === 'year' && renderYearFilter()}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center">
                      Incident Year
                    </span>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center">
                      Receive Date(s)
                    </span>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center relative">
                      <button 
                        className="flex items-center focus:outline-none mr-2" 
                        onClick={() => handleSort('source')}
                      >
                        Source
                        {renderSortIndicator('source')}
                      </button>
                      
                      <button 
                        onClick={() => toggleFilterDropdown('source')}
                        className={`p-1 rounded-md ${filters.source ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200'}`}
                      >
                        <Filter className="h-3 w-3" />
                      </button>
                      
                      {activeFilterDropdown === 'source' && renderSourceFilter()}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center">
                      Officers
                    </span>
                  </th>
                  {searchTerm && textMatches.size > 0 && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="flex items-center">
                        Match Context
                      </span>
                    </th>
                  )}
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedCases.length > 0 ? (
                  paginatedCases.map((caseData) => (
                    <tr 
                      key={caseData.incident_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleCaseSelection(caseData)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <FileText className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {caseData.incident_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getIncidentTypeColor(caseData.incident_type)}`}>
                          {caseData.incident_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                          {formatDate(caseData.incident_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatIncidentYear(caseData.incident_year)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatReceiveDates(caseData.receive_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {caseData.source || ""}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {caseData.officers.length}
                        </span>
                        {caseData.officers.length > 0 && (
                          <span className="ml-2 text-xs text-gray-500 truncate max-w-[120px] inline-block align-middle">
                            {caseData.officers[0].name || ""}
                            {caseData.officers.length > 1 && ` +${caseData.officers.length - 1} more`}
                          </span>
                        )}
                      </td>
                      {searchTerm && textMatches.size > 0 && (
                        <td className="px-6 py-4 max-w-xs truncate">
                          <p className="text-xs text-gray-500">
                            {hasTextMatches(caseData) ? (
                              <span className="italic">{getMatchSnippet(caseData)}</span>
                            ) : (
                              <span>No content match</span>
                            )}
                          </p>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-gray-400 hover:text-gray-500">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={searchTerm && textMatches.size > 0 ? 9 : 8} className="px-6 py-8 text-center text-gray-500">
                      No cases matching your criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-4 text-sm">
          <div className="text-gray-500">
            {filteredAndSortedCases.length > 0 ? (
              <>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedCases.length)} of {filteredAndSortedCases.length} cases</>
            ) : (
              <>No cases found</>
            )}
          </div>
          
          {filteredAndSortedCases.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="mr-4">
                <select 
                  className="form-select border-gray-300 rounded-md text-sm"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(1)} 
                  disabled={currentPage === 1}
                  className="px-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <ChevronLeft className="w-4 h-4 -ml-2" />
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handlePrevPage} 
                  disabled={currentPage === 1}
                  className="px-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {currentPage} of {totalPages || 1}
                </span>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleNextPage} 
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-2"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)} 
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-2"
                >
                  <ChevronRight className="w-4 h-4" />
                  <ChevronRight className="w-4 h-4 -ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};