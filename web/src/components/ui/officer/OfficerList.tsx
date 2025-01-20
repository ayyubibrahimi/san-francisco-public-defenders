import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/base/input';
import _ from 'lodash';
import { OfficerCard } from './OfficerCard';
import { Officer, Incident } from '../../types/officer';
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
        // Initialize Supabase client
        console.log('Initializing Supabase client...');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        console.log('Supabase URL available:', !!supabaseUrl);
        console.log('Supabase key available:', !!supabaseKey);
        
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase credentials are not configured');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Test connection with a simple query
        console.log('Testing Supabase connection...');
        const { data: testData, error: testError } = await supabase
          .from('document_metadata')
          .select('officer_name')
          .limit(1);

        if (testError) {
          console.error('Connection test error:', testError);
          throw new Error(`Supabase connection test failed: ${testError.message}`);
        }

        console.log('Connection test result:', testData);

        // If connection test passes, fetch all data
        console.log('Fetching all document metadata...');
        const { data: documents, error: fetchError } = await supabase
          .from('document_metadata')
          .select(`
            sfpd_incident_id,
            officer_name,
            incident_id,
            incident_type,
            source,
            incident_date,
            star_no,
            officer_agency,
            ois_details,
            incident_details,
            uid,
            sha1
          `);

        if (fetchError) {
          console.error('Data fetch error:', fetchError);
          throw new Error(`Failed to fetch data: ${fetchError.message}`);
        }

        if (!documents || documents.length === 0) {
          console.log('No documents found in the table');
          setOfficers([]);
          setLoading(false);
          return;
        }

        console.log(`Found ${documents.length} documents`);
        console.log('Sample document:', documents[0]);

        // Process the data similarly to the original CSV processing
        const officerData = _.groupBy(documents, 'uid');
        const processedOfficers = Object.entries(officerData).map(([uid, incidents]) => ({
          uid,
          name: incidents[0].officer_name,
          starNo: incidents[0].star_no,
          agency: incidents[0].officer_agency || 'SFPD',
          incidentCount: incidents.length,
          incidents: incidents
        }));

        console.log(`Processed ${processedOfficers.length} officers`);
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

  if (loading) {
    return <div className="text-center p-4">Loading officer data...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-600">
        Error: {error}
      </div>
    );
  }

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