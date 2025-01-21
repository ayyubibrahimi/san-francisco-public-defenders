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
        console.log('Initializing Supabase client...');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        console.log('Supabase URL available:', !!supabaseUrl);
        console.log('Supabase key available:', !!supabaseKey);
        
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase credentials are not configured');
        }
    
        const supabase = createClient(supabaseUrl, supabaseKey);
        const pageSize = 1000;
        let allDocuments = [];
        let hasMore = true;
        let page = 0;
    
        console.log('Fetching document metadata in chunks...');
        while (hasMore) {
          const { data: documents, error: fetchError } = await supabase
            .from('document_metadata')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);
    
          if (fetchError) {
            console.error('Data fetch error:', fetchError);
            throw new Error(`Failed to fetch data: ${fetchError.message}`);
          }
    
          if (!documents || documents.length === 0) {
            hasMore = false;
            continue;
          }
    
          allDocuments = [...allDocuments, ...documents];
          console.log(`Fetched chunk ${page + 1}: ${documents.length} records`);
          
          hasMore = documents.length === pageSize;
          page++;
        }
    
        console.log(`Total documents found: ${allDocuments.length}`);
        
        // Add logging for unique UIDs in raw data
        const uniqueUids = new Set(allDocuments.map(doc => doc.uid));
        console.log(`Raw data has ${uniqueUids.size} unique UIDs`);
    
        // Log before grouping
        console.log('Starting groupBy operation...');
        const officerData = _.groupBy(allDocuments, 'uid');
        console.log(`After groupBy: ${Object.keys(officerData).length} groups`);
    
        // Log before mapping
        console.log('Starting officer processing...');
        const processedOfficers = Object.entries(officerData).map(([uid, incidents]) => {
          // Add logging for each officer's incidents
          if (incidents.length === 0) {
            console.warn(`No incidents found for UID: ${uid}`);
          }
          return {
            uid,
            name: incidents[0]?.officer_name,
            starNo: incidents[0]?.star_no,
            agency: incidents[0]?.officer_agency || 'SFPD',
            incidentCount: incidents.length,
            incidents: incidents
          };
        });
    
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