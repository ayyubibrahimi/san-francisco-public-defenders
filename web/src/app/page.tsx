'use client';

import React, { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/base/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/base/tabs';
import { Officer } from '../components/types/officer';
import { Case } from '../components/types/case';
import { OfficerList } from '../components/ui/officer/OfficerList';
import { OfficerProfile } from '../components/ui/officer/OfficerProfile';
import { CaseList } from '../components/ui/case/CaseList';
import { CaseProfile } from '../components/ui/case/CaseProfile';
import { createClient } from '@supabase/supabase-js';

export default function App() {
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [activeView, setActiveView] = useState<'officers' | 'cases'>('officers');

  // Helper function to initialize Supabase client
  const initSupabase = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials are not configured');
    }

    return createClient(supabaseUrl, supabaseKey);
  };

  const handleOfficerSelect = (officer: Officer) => {
    setSelectedOfficer(officer);
    setSelectedCase(null);
  };

  const handleCaseSelect = (caseData: Case) => {
    setSelectedCase(caseData);
    setSelectedOfficer(null);
  };

  const handleOfficerFromCase = async (uid: string) => {
    try {
      const supabase = initSupabase();
      
      // Fetch all document metadata for the officer
      const { data: documents, error } = await supabase
        .from('document_metadata')
        .select('*')
        .eq('uid', uid);

      if (error) throw error;
      
      if (!documents || documents.length === 0) {
        console.error('No documents found for officer:', uid);
        return;
      }

      // Process the officer data
      const incidents = documents;
      const officer: Officer = {
        uid,
        name: incidents[0].officer_name,
        starNo: incidents[0].star_no,
        agency: incidents[0].officer_agency || 'SFPD',
        incidentCount: incidents.length,
        incidents: incidents
      };

      // Update the UI
      setActiveView('officers');
      setSelectedCase(null);
      setSelectedOfficer(officer);
    } catch (error) {
      console.error('Error fetching officer data:', error);
      // You might want to show an error message to the user here
    }
  };

  const handleCaseFromOfficer = async (incidentId: string) => {
    try {
      const supabase = initSupabase();
      
      // Fetch all document metadata for the incident
      const { data: documents, error } = await supabase
        .from('document_metadata')
        .select('*')
        .eq('incident_id', incidentId);

      if (error) throw error;

      if (!documents || documents.length === 0) {
        console.error('No documents found for case:', incidentId);
        return;
      }

      // Process the case data
      const caseData: Case = {
        incident_id: incidentId,
        incident_type: documents[0].incident_type,
        incident_date: documents[0].incident_date,
        source: documents[0].source,
        ois_details: documents[0].ois_details,
        incident_details: documents[0].incident_details,
        officers: documents.map(doc => ({
          uid: doc.uid,
          name: doc.officer_name,
          starNo: doc.star_no,
          agency: doc.officer_agency
        }))
      };

      // Update the UI
      setActiveView('cases');
      setSelectedOfficer(null);
      setSelectedCase(caseData);
    } catch (error) {
      console.error('Error fetching case data:', error);
      // You might want to show an error message to the user here
    }
  };

  if (selectedOfficer) {
    return (
      <OfficerProfile
        officer={selectedOfficer}
        onBack={() => setSelectedOfficer(null)}
        onCaseSelect={handleCaseFromOfficer}
      />
    );
  }

  if (selectedCase) {
    return (
      <CaseProfile
        case={selectedCase}
        onBack={() => setSelectedCase(null)}
        onOfficerSelect={handleOfficerFromCase}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <Card className="mb-8">
          <CardHeader>
            <h1 className="text-3xl font-bold">SFPD Database</h1>
            <p className="text-gray-600">
              Tracking incidents, cases, and officer activities
            </p>
          </CardHeader>
        </Card>

        <Tabs value={activeView} onValueChange={(value: string) => setActiveView(value as 'officers' | 'cases')}>
          <TabsList className="mb-8">
            <TabsTrigger value="officers">Officers</TabsTrigger>
            <TabsTrigger value="cases">Cases</TabsTrigger>
          </TabsList>

          <TabsContent value="officers">
            <OfficerList onOfficerSelect={handleOfficerSelect} />
          </TabsContent>

          <TabsContent value="cases">
            <CaseList onCaseSelect={handleCaseSelect} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}