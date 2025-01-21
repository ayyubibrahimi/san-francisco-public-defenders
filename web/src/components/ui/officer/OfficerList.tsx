import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/base/input';
import _ from 'lodash';
import { OfficerCard } from './OfficerCard';
import { Officer, Incident, PostRecord } from '../../types/officer';
import { createClient } from '@supabase/supabase-js';

// Document metadata interface matching the schema
interface DocumentMetadata {
  sfpd_incident_id: string;
  officer_name: string;
  recieve_date: string;
  incident_id: string;
  incident_type: string;
  source: string;
  incident_date: string;
  star_no: string;
  officer_agency: string;
  ois_details: string;
  incident_details: string;
  uid: string;
  incident_description: string;
  last_name: string;
  suffix: string;
  first_name: string;
  middle_name: string;
  agency_type: string;
  post_uid: string;
}

interface OfficerListProps {
  onOfficerSelect: (officer: Officer) => void;
}

export const OfficerList: React.FC<OfficerListProps> = ({ onOfficerSelect }) => {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert DocumentMetadata to Incident type
  const convertToIncident = (doc: DocumentMetadata): Incident => {
    const starNo = doc.star_no ? parseInt(doc.star_no) : null;
    
    return {
      incident_id: doc.incident_id,
      incident_type: doc.incident_type,
      incident_date: doc.incident_date,
      source: doc.source,
      officer_name: doc.officer_name,
      star_no: isNaN(starNo as number) ? null : starNo,
      officer_agency: doc.officer_agency,
      uid: doc.uid,
      post_uid: doc.post_uid || null,
      ois_details: doc.ois_details,
      incident_details: doc.incident_details
    };
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Initializing Supabase client...');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase credentials are not configured');
        }
    
        const supabase = createClient(supabaseUrl, supabaseKey);
        const pageSize = 1000;
        let allDocuments: DocumentMetadata[] = [];
        let hasMore = true;
        let page = 0;
    
        while (hasMore) {
          const { data: documents, error: fetchError } = await supabase
            .from('document_metadata')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);
    
          if (fetchError) throw new Error(`Failed to fetch data: ${fetchError.message}`);
          if (!documents || documents.length === 0) {
            hasMore = false;
            continue;
          }
    
          allDocuments = [...allDocuments, ...documents];
          hasMore = documents.length === pageSize;
          page++;
        }

        const postUids = new Set(
          allDocuments
            .map(doc => doc.post_uid)
            .filter(uid => uid != null)
        );

        const { data: postRecords, error: postError } = await supabase
          .from('post')
          .select('*')
          .in('post_uid', Array.from(postUids));

        if (postError) throw new Error(`Failed to fetch post data: ${postError.message}`);

        const officerData = _.groupBy(allDocuments, 'uid');
        
        const processedOfficers: Officer[] = Object.entries(officerData).map(([uid, incidents]) => {
          const firstIncident = incidents[0];
          const officerPostRecords = (postRecords as PostRecord[] || []).filter(
            post => post.post_uid === firstIncident.post_uid
          );

          const sortedPostRecords = _.orderBy(
            officerPostRecords, 
            ['start_date'], 
            ['asc']
          );

          // Convert star_no to number
          const starNo = firstIncident?.star_no ? parseInt(firstIncident.star_no) : null;

          // Construct full name from components if available
          let name = firstIncident?.officer_name;
          if (!name && firstIncident) {
            name = [
              firstIncident.first_name,
              firstIncident.middle_name,
              firstIncident.last_name,
              firstIncident.suffix
            ].filter(Boolean).join(' ');
          }

          // Convert all incidents to proper Incident type
          const convertedIncidents = incidents.map(convertToIncident);

          const officer: Officer = {
            uid,
            name: name || '',
            starNo: isNaN(starNo as number) ? null : starNo,
            agency: firstIncident?.officer_agency || 'SFPD',
            incidentCount: incidents.length,
            incidents: convertedIncidents,
            postHistory: sortedPostRecords,
            currentPost: sortedPostRecords.length > 0 ? 
              sortedPostRecords[sortedPostRecords.length - 1] : null,
            serviceStartDate: sortedPostRecords.length > 0 ? 
              sortedPostRecords[0].start_date : null
          };

          return officer;
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
}