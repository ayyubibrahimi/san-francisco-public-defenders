import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/base/input';
import { Button } from '@/components/ui/base/button';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, User, Calendar, MoreVertical } from 'lucide-react';
import _ from 'lodash';
import { Officer, Incident, PostRecord } from '../../types/officer';
import { createClient } from '@supabase/supabase-js';

interface OfficerListProps {
  onOfficerSelect: (officer: Officer) => void;
}

export const OfficerList: React.FC<OfficerListProps> = ({ onOfficerSelect }) => {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default to 10 items per page

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase credentials are not configured');
        }
    
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // 1. First fetch all documents
        const { data: documents, error: docsError } = await supabase
          .from('document_metadata')
          .select('*');

        if (docsError || !documents) {
          throw new Error(docsError ? docsError.message : 'No documents returned');
        }

        // 2. Collect post_uids that exist
        const postUids = new Set(
          documents
            .map(doc => doc.post_uid)
            .filter(uid => uid != null)
        );

        // 3. Fetch all post records for these post_uids
        let postRecords: PostRecord[] = [];
        if (postUids.size > 0) {
          const { data: posts, error: postsError } = await supabase
            .from('post')
            .select('post_uid, agency_name, start_date, end_date')
            .in('post_uid', Array.from(postUids));

          if (postsError) throw new Error(postsError.message);
          if (posts) {
            // Convert posts to PostRecord type, keeping all records
            postRecords = posts.map(post => ({
              post_uid: post.post_uid,
              agency_name: post.agency_name,
              start_date: post.start_date,
              end_date: post.end_date,
              officer_name: '' // We'll fill this in during officer processing
            }));
          }
        }

        // 4. Group documents by officer uid
        const officerGroups = _.groupBy(documents, 'uid');
        
        // 5. Process each officer's data
        const processedOfficers = Object.entries(officerGroups).map(([uid, incidents]) => {
          // Get the officer's basic info from their first incident
          const firstIncident = incidents[0];
          
          // Get all post records for this officer's incidents
          const officerPostRecords = postRecords
            .filter(post => incidents.some(inc => inc.post_uid === post.post_uid))
            .map(post => ({
              ...post,
              officer_name: firstIncident.officer_name
            }));

          // Sort post records by date
          const sortedPosts = _.orderBy(officerPostRecords, ['start_date'], ['desc']);

          return {
            uid,
            name: firstIncident.officer_name || '',
            starNo: firstIncident.star_no ? Number(firstIncident.star_no) : null,
            agency: firstIncident.officer_agency || 'SFPD',
            incidentCount: incidents.length,
            incidents: incidents.map(inc => ({
              incident_id: inc.incident_id,
              incident_type: inc.incident_type,
              incident_date: inc.incident_date,
              source: inc.source,
              officer_name: inc.officer_name,
              star_no: inc.star_no ? Number(inc.star_no) : null,
              officer_agency: inc.officer_agency,
              uid: inc.uid,
              post_uid: inc.post_uid,
              ois_details: inc.ois_details,
              incident_details: inc.incident_details,
              incident_uid: inc.incident_id
            })),
            postHistory: sortedPosts,
            currentPost: sortedPosts[0] || null,
            serviceStartDate: sortedPosts.length > 0 ? 
              _.minBy(sortedPosts, 'start_date')?.start_date || null : null
          };
        });

        setOfficers(processedOfficers);
        setLoading(false);
      } catch (error) {
        console.error('Error in loadData:', error);
        setError(error instanceof Error ? error.message : 'Failed to load officer data');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

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

  // Sort and filter officers
  const getSortedAndFilteredOfficers = () => {
    // First filter by search term
    const result = officers.filter(officer =>
      officer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      officer.agency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (officer.starNo && officer.starNo.toString().includes(searchTerm))
    );
    
    // Then sort by the selected field
    return _.orderBy(
      result,
      [sortField],
      [sortDirection]
    );
  };

  const filteredAndSortedOfficers = getSortedAndFilteredOfficers();

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedOfficers.length / itemsPerPage);
  const paginatedOfficers = filteredAndSortedOfficers.slice(
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

  // Get the most common incident type for an officer
  const getMostCommonIncidentType = (officer: Officer) => {
    if (!officer.incidents || officer.incidents.length === 0) return 'Unknown';
    
    const typeCounts = _.countBy(officer.incidents, 'incident_type');
    return Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
  };

  // Format date function
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  if (loading) return <div className="text-center p-4">Loading officer data...</div>;
  if (error) return <div className="text-center p-4 text-red-600">Error: {error}</div>;

  return (
    <div>
      <div className="mb-6">
        <p className="text-gray-500 text-sm mb-4">
          Browse and search through {officers.length} officers
        </p>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <Input
            type="text"
            placeholder="Search officers by name, star number, or agency..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on new search
            }}
            className="w-full pl-10"
          />
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    className="flex items-center focus:outline-none" 
                    onClick={() => handleSort('name')}
                  >
                    Officer
                    {renderSortIndicator('name')}
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    className="flex items-center focus:outline-none" 
                    onClick={() => handleSort('starNo')}
                  >
                    Star No.
                    {renderSortIndicator('starNo')}
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    className="flex items-center focus:outline-none" 
                    onClick={() => handleSort('agency')}
                  >
                    Agency
                    {renderSortIndicator('agency')}
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    className="flex items-center focus:outline-none" 
                    onClick={() => handleSort('incidentCount')}
                  >
                    Incidents
                    {renderSortIndicator('incidentCount')}
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="flex items-center">
                    Primary Type
                  </span>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button 
                    className="flex items-center focus:outline-none" 
                    onClick={() => handleSort('serviceStartDate')}
                  >
                    Employment Start Date
                    {renderSortIndicator('serviceStartDate')}
                  </button>
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedOfficers.map((officer) => {
                const mostCommonType = getMostCommonIncidentType(officer);
                return (
                  <tr 
                    key={officer.uid}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onOfficerSelect(officer)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {officer.name || "Unknown"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {officer.starNo || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {officer.agency || "SFPD"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {officer.incidentCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getIncidentTypeColor(mostCommonType)}`}>
                        {mostCommonType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                        {formatDate(officer.serviceStartDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-gray-400 hover:text-gray-500">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4 text-sm">
        <div className="text-gray-500">
          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedOfficers.length)} of {filteredAndSortedOfficers.length} officers
        </div>
        
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
      </div>
    </div>
  );
};