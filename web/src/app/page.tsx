'use client';

import React, { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/base/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/base/tabs';
import { Officer, PostRecord, Incident } from '../components/types/officer';
import { Case } from '../components/types/case';
import { OfficerList } from '../components/ui/officer/OfficerList';
import { OfficerProfile } from '../components/ui/officer/OfficerProfile';
import { CaseList } from '../components/ui/case/CaseList';
import { CaseProfile } from '../components/ui/case/CaseProfile';
import { createClient } from '@supabase/supabase-js';
import _ from 'lodash';

interface PostTableRow {
  post_uid: string;
  officer_name: string;
  agency_name: string;
  start_date: string;
  end_date: string | null;
}

export default function App() {
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [activeView, setActiveView] = useState<'officers' | 'cases'>('officers');

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
      const { data: documents, error: docError } = await supabase
        .from('document_metadata')
        .select('*')
        .eq('uid', uid);

      if (docError) throw docError;
      
      if (!documents || documents.length === 0) {
        console.error('No documents found for officer:', uid);
        return;
      }

      // Fetch post data for the officer
      const officerName = documents[0].officer_name;
      const { data: postData, error: postError } = await supabase
        .from('post')
        .select('*')
        .eq('officer_name', officerName);

      if (postError) throw postError;

      // Process post records
      const postRecords: PostRecord[] = (postData || []).map((post: PostTableRow) => ({
        post_uid: post.post_uid,
        officer_name: post.officer_name,
        agency_name: post.agency_name,
        start_date: post.start_date,
        end_date: post.end_date
      }));

      // Sort posts by date to find current post and start date
      const sortedPosts = _.sortBy(postRecords, 'start_date').reverse();
      const currentPost = sortedPosts.find(post => !post.end_date) || null;
      const serviceStartDate = sortedPosts.length > 0 
        ? _.minBy(sortedPosts, 'start_date')?.start_date || null 
        : null;

      // Process the officer data
      const officer: Officer = {
        uid,
        name: documents[0].officer_name,
        starNo: documents[0].star_no ? Number(documents[0].star_no) : null,
        agency: documents[0].officer_agency || 'SFPD',
        incidentCount: documents.length,
        incidents: documents.map(doc => ({
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
        })),
        postHistory: postRecords,
        currentPost,
        serviceStartDate
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
      
      const { data: documents, error } = await supabase
        .from('document_metadata')
        .select('*')
        .eq('incident_id', incidentId);

      if (error) throw error;

      if (!documents || documents.length === 0) {
        console.error('No documents found for case:', incidentId);
        return;
      }

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
          starNo: doc.star_no ? Number(doc.star_no) : null,
          agency: doc.officer_agency || 'SFPD'
        }))
      };

      setActiveView('cases');
      setSelectedOfficer(null);
      setSelectedCase(caseData);
    } catch (error) {
      console.error('Error fetching case data:', error);
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