import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/base/card';
import { Input } from '@/components/ui/base/input';
import { Button } from '@/components/ui/base/button';
import { Badge } from '@/components/ui/base/badge';
import { 
  ChevronRight, 
  ChevronLeft, 
  Search, 
  Users, 
  AlertCircle, 
  Shield,
  Filter,
  TrendingUp,
  Clock
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import _ from 'lodash';
import { Officer, Incident, PostRecord } from '../../types/officer';
import { Case } from '../../types/case';

interface IncidentTypeCount {
  type: string;
  count: number;
  color: string;
}

interface DashboardProps {
  onOfficerSelect: (officer: Officer) => void;
  onCaseSelect: (caseData: Case) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOfficerSelect, onCaseSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [incidentTypeCounts, setIncidentTypeCounts] = useState<IncidentTypeCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    totalOfficers: 0,
    totalIncidents: 0,
    incidentsThisYear: 0,
    agenciesRepresented: 0,
    mostCommonIncidentType: '',
    recentActivityCount: 0
  });
  
  const itemsPerPage = 8; // Increased to show more officers at once

  // Color mapping for incident types
  const getColorForIncidentType = (type: string): string => {
    const colorMap: { [key: string]: string } = {
      'firearm': '#ef4444', // red
      'great bodily injury': '#f97316', // orange
      'prejudice or discrimination': '#eab308', // yellow
      'dishonesty': '#ec4899', // pink
      'unlawful search/arrest': '#8b5cf6', // purple
      'excessive force': '#dc2626', // darker red
      'sexual assault': '#0ea5e9', // sky blue
      'unlawful search/arrest,excessive force': '#14b8a6', // teal
      'missing': '#6366f1', // indigo
      'in custody death': '#b91c1c', // dark red
    };

    return colorMap[type.toLowerCase()] || '#6b7280'; // gray default
  };

  // Initialize Supabase client
  const initSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials are not configured');
    }

    return createClient(supabaseUrl, supabaseKey);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const supabase = initSupabase();
        
        // 1. Fetch all documents
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
            .select('post_uid, agency_name, start_date, end_date, officer_name');

          if (postsError) throw new Error(postsError.message);
          if (posts) {
            postRecords = posts.map(post => ({
              post_uid: post.post_uid,
              agency_name: post.agency_name,
              start_date: post.start_date,
              end_date: post.end_date,
              officer_name: post.officer_name || ''
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

          const processedIncidents = incidents.map(inc => ({
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
          }));

          return {
            uid,
            name: firstIncident.officer_name || '',
            starNo: firstIncident.star_no ? Number(firstIncident.star_no) : null,
            agency: firstIncident.officer_agency || 'SFPD',
            incidentCount: incidents.length,
            incidents: processedIncidents,
            postHistory: sortedPosts,
            currentPost: sortedPosts[0] || null,
            serviceStartDate: sortedPosts.length > 0 ? 
              _.minBy(sortedPosts, 'start_date')?.start_date || null : null
          };
        });

        // 6. Process and set recent incidents (last 5)
        const allIncidents = documents.map(doc => ({
          incident_id: doc.incident_id,
          incident_type: doc.incident_type,
          incident_date: doc.incident_date,
          source: doc.source,
          officer_name: doc.officer_name,
          star_no: doc.star_no ? Number(doc.star_no) : null,
          officer_agency: doc.officer_agency,
          uid: doc.uid,
          post_uid: doc.post_uid,
          ois_details: doc.ois_details,
          incident_details: doc.incident_details,
          incident_uid: doc.incident_id
        }));
        
        // Sort by date (most recent first) and take top 5
        const sortedIncidents = _.orderBy(allIncidents, ['incident_date']);
        const recentIncidentsList = _.uniqBy(sortedIncidents, 'incident_id').slice(0, 5);
        
        // 7. Calculate incident type breakdown
        // First get unique incidents (don't count same incident multiple times)
        const uniqueIncidents = _.uniqBy(documents, 'incident_id');
        
        // Count incidents by type
        const incidentTypeMap = _.countBy(uniqueIncidents, 'incident_type');
        
        // Convert to array of objects for easy rendering
        const typeBreakdown = Object.entries(incidentTypeMap)
          .map(([type, count]) => ({
            type,
            count,
            color: getColorForIncidentType(type)
          }))
          .sort((a, b) => b.count - a.count); // Sort by count descending
        
        // 8. Calculate statistics
        const uniqueOfficerCount = processedOfficers.length;
        const totalIncidentCount = uniqueIncidents.length; // Use unique incidents count
        const uniqueAgencies = new Set(documents.map(doc => doc.officer_agency).filter(Boolean)).size;
        
        // Count incidents in current year
        const currentYear = new Date().getFullYear();
        const incidentsThisYear = uniqueIncidents.filter(doc => {
          if (!doc.incident_date) return false;
          const incidentYear = new Date(doc.incident_date).getFullYear();
          return incidentYear === currentYear;
        }).length;
        
        // Find most common incident type
        const mostCommonIncidentType = typeBreakdown.length > 0 ? typeBreakdown[0].type : '';
        
        // Recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentActivityCount = uniqueIncidents.filter(doc => {
          if (!doc.incident_date) return false;
          const incidentDate = new Date(doc.incident_date);
          return incidentDate >= thirtyDaysAgo;
        }).length;
        
        // Update state
        setOfficers(processedOfficers);
        setRecentIncidents(recentIncidentsList);
        setIncidentTypeCounts(typeBreakdown);
        setStats({
          totalOfficers: uniqueOfficerCount,
          totalIncidents: totalIncidentCount,
          incidentsThisYear,
          agenciesRepresented: uniqueAgencies,
          mostCommonIncidentType,
          recentActivityCount
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error in loadData:', error);
        setError(error instanceof Error ? error.message : 'Failed to load data');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Filter officers based on search term
  const filteredOfficers = officers.filter(officer =>
    officer.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Pagination logic
  const totalPages = Math.ceil(filteredOfficers.length / itemsPerPage);
  const paginatedOfficers = filteredOfficers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
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

  if (error) {
    return <div className="text-center p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-3">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">1421 db Dashboard</h1>
        </div>
        
        {/* Key stats - More compact design */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardDescription className="text-xs">Total Officers</CardDescription>
              <CardTitle className="text-2xl">
                {loading ? '...' : stats.totalOfficers}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 pt-0 px-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                <Users className="h-3 w-3 mr-1" />
                <span>{loading ? '...' : stats.agenciesRepresented} agencies</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardDescription className="text-xs">Total Incidents</CardDescription>
              <CardTitle className="text-2xl">
                {loading ? '...' : stats.totalIncidents}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 pt-0 px-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                <span>{loading ? '...' : stats.incidentsThisYear} this year</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardDescription className="text-xs">Recent Activity</CardDescription>
              <CardTitle className="text-2xl">
                {loading ? '...' : stats.recentActivityCount}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 pt-0 px-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                <span>Last 30 days</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardDescription className="text-xs">Top Incident Type</CardDescription>
              <CardTitle className="text-lg truncate">
                {loading ? '...' : stats.mostCommonIncidentType}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 pt-0 px-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                <span>Most reported</span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Left side: Officer listing - Spans 3 columns now */}
          <div className="lg:col-span-3">
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Officers</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative w-48 md:w-64">
                      <Search className="absolute left-2 top-2 h-4 w-4 text-gray-500" />
                      <Input
                        type="search"
                        placeholder="Search officers..."
                        className="pl-8 h-8 text-sm"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                      />
                    </div>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-2 px-3">
                {loading ? (
                  <div className="text-center py-4">Loading officer data...</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {paginatedOfficers.map((officer) => (
                        <div
                          key={officer.uid}
                          className="flex items-center space-x-3 p-2 rounded-md border hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => onOfficerSelect(officer)}
                        >
                          <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 font-medium text-sm">
                            {officer.name.split(',')[0][0]}
                            {officer.name.includes(',') && officer.name.split(',')[1].trim()[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{officer.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {officer.starNo ? `Badge # ${officer.starNo} • ` : ''}{officer.currentPost?.agency_name || officer.agency}
                            </p>
                          </div>
                          <Badge 
                            variant={officer.incidentCount > 3 ? "destructive" : "secondary"}
                            className="ml-auto text-xs"
                          >
                            {officer.incidentCount} {officer.incidentCount === 1 ? 'incident' : 'incidents'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    
                    {/* Pagination */}
                    {filteredOfficers.length > itemsPerPage && (
                      <div className="flex justify-between items-center mt-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredOfficers.length)} of {filteredOfficers.length}
                        </div>
                        
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handlePrevPage} 
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="w-3 h-3" />
                            <span className="ml-1">Prev</span>
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleNextPage} 
                            disabled={currentPage === totalPages}
                          >
                            <span className="mr-1">Next</span>
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Right side: Incident Types and Recent Incidents - Spans 2 columns now */}
          <div className="lg:col-span-2 space-y-3">
            {/* Incident Type Breakdown */}
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-base">Incident Type Breakdown</CardTitle>
                <CardDescription className="text-xs">
                  Distribution by incident type
                </CardDescription>
              </CardHeader>
              <CardContent className="py-2 px-3">
                {loading ? (
                  <div className="text-center py-4">Loading incident data...</div>
                ) : (
                  <div className="space-y-2">
                    {incidentTypeCounts.slice(0, 8).map((typeData) => (
                      <div key={typeData.type}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium truncate pr-2">{typeData.type}</span>
                          <span className="text-xs text-gray-500">{typeData.count}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full" 
                            style={{
                              width: `${(typeData.count / stats.totalIncidents) * 100}%`,
                              backgroundColor: typeData.color
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Recent Incidents */}
            {/* <Card className="shadow-sm">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-base">Recent Incidents</CardTitle>
                <CardDescription className="text-xs">
                  Latest reported incidents
                </CardDescription>
              </CardHeader>
              <CardContent className="py-2 px-3">
                {loading ? (
                  <div className="text-center py-4">Loading incident data...</div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {recentIncidents.map((incident) => (
                        <div 
                          key={incident.incident_id}
                          className="flex items-start space-x-2 p-2 rounded-md border hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => onCaseSelect({ 
                            incident_id: incident.incident_id,
                            incident_type: incident.incident_type,
                            incident_date: incident.incident_date,
                            source: incident.source,
                            ois_details: incident.ois_details,
                            incident_details: incident.incident_details,
                            officers: [{
                              uid: incident.uid,
                              name: incident.officer_name || '',
                              starNo: incident.star_no,
                              agency: incident.officer_agency || 'SFPD'
                            }]
                          })}
                        >
                          <div className="flex-shrink-0 mt-1">
                            <div 
                              className="h-6 w-6 rounded-full flex items-center justify-center"
                              style={{ 
                                backgroundColor: `${getColorForIncidentType(incident.incident_type)}20`, 
                              }}
                            >
                              <Shield 
                                className="h-3 w-3" 
                                style={{ color: getColorForIncidentType(incident.incident_type) }}
                              />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                              <p className="font-medium text-xs">{incident.incident_type}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {incident.incident_date ? new Date(incident.incident_date).toLocaleDateString() : 'No date'}
                              </p>
                            </div>
                            <p className="text-xs truncate">{incident.officer_name || 'Unknown Officer'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {incident.star_no ? `Star #${incident.star_no}` : 'No star number'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full text-xs h-7"
                        onClick={() => {
                          // This would navigate to the cases tab in your application
                          // You'll need to implement this navigation
                        }}
                      >
                        View All Incidents
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card> */}
          </div>
        </div>
      </div>
    </div>
  );
};