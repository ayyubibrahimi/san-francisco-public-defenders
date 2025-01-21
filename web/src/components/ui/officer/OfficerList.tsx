import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/base/input';
import _ from 'lodash';
import { OfficerCard } from './OfficerCard';
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

  const filteredOfficers = officers.filter(officer =>
    officer.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="text-center p-4">Loading officer data...</div>;
  if (error) return <div className="text-center p-4 text-red-600">Error: {error}</div>;

  return (
    <div>
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search officers by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredOfficers.map((officer) => (
          <OfficerCard
            key={officer.uid}
            officer={officer}
            onClick={onOfficerSelect}
          />
        ))}
      </div>
    </div>
  );
};