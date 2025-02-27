import React from 'react';
import { Card, CardContent } from '@/components/ui/base/card';
import { Button } from '@/components/ui/base/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/base/tabs';
import { ScrollArea } from '@/components/ui/base/scroll-area';
import { Badge } from '@/components/ui/base/badge';
import { ArrowLeft, Shield, Briefcase } from 'lucide-react';
import { Officer, PostRecord } from '../../types/officer';
import { IncidentCard } from './IncidentCard';
import _ from 'lodash';

interface OfficerProfileProps {
  officer: Officer | null;
  onBack: () => void;
  onCaseSelect: (incidentId: string) => void;
}

interface PostHistoryCardProps {
  post: PostRecord;
}

const PostHistoryCard: React.FC<PostHistoryCardProps> = ({ post }) => {
  const startDate = new Date(post.start_date).toLocaleDateString();
  const endDate = post.end_date ? new Date(post.end_date).toLocaleDateString() : 'Present';
  
  return (
    <div className="p-4 hover:bg-muted/50">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-muted rounded-lg">
          <Briefcase className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium">{post.agency_name}</h3>
          <p className="text-sm text-muted-foreground">
            {startDate} - {endDate}
          </p>
        </div>
      </div>
    </div>
  );
};

export const OfficerProfile: React.FC<OfficerProfileProps> = ({ 
  officer, 
  onBack,
  onCaseSelect
}) => {
  // Group incidents by incident_uid and take the first occurrence
  const uniqueIncidents = React.useMemo(() => {
    if (!officer) return [];
    return _.map(
      _.groupBy(officer.incidents, 'incident_uid'),
      group => group[0]
    );
  }, [officer]);

  const uniqueIncidentTypes = React.useMemo(() => {
    if (!officer) return [];
    const types = new Set(uniqueIncidents.map(incident => incident.incident_type));
    return Array.from(types).filter(Boolean).sort();
  }, [uniqueIncidents]);

  if (!officer) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <Button
          onClick={onBack}
          variant="ghost"
          className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Officer List
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p>Officer data not available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <Button
        onClick={onBack}
        variant="ghost"
        className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Officer List
      </Button>

      <div className="grid gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-muted rounded-lg">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold capitalize mb-1">{officer.name}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{officer.agency}</span>
                    {officer.starNo && (
                      <>
                        <span>•</span>
                        <span>Badge #{officer.starNo}</span>
                      </>
                    )}
                    {officer.serviceStartDate && (
                      <>
                        <span>•</span>
                        <span>Since {new Date(officer.serviceStartDate).getFullYear()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-base px-4 py-1">
                  {uniqueIncidents.length} Incident{uniqueIncidents.length !== 1 ? 's' : ''}
                </Badge>
                {officer.postHistory?.length > 0 && (
                  <Badge variant="outline" className="text-base px-4 py-1">
                    {officer.postHistory.length} Assignment{officer.postHistory.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start mb-4 overflow-x-auto">
            <TabsTrigger value="all" className="flex-1 md:flex-none">
              All Incidents
            </TabsTrigger>
            {uniqueIncidentTypes.map(type => (
              <TabsTrigger 
                key={type} 
                value={type}
                className="flex-1 md:flex-none capitalize"
              >
                {type}
              </TabsTrigger>
            ))}
            {officer.postHistory?.length > 0 && (
              <TabsTrigger 
                value="employment"
                className="flex-1 md:flex-none"
              >
                Employment History
              </TabsTrigger>
            )}
          </TabsList>

          <ScrollArea className="h-[600px] rounded-lg border bg-card">
            <TabsContent value="all" className="m-0">
              <div className="divide-y">
                {uniqueIncidents.map((incident, index) => (
                  <IncidentCard 
                    key={incident.incident_uid || index} 
                    incident={incident}
                    onCaseSelect={onCaseSelect}
                  />
                ))}
              </div>
            </TabsContent>

            {uniqueIncidentTypes.map(type => (
              <TabsContent key={type} value={type} className="m-0">
                <div className="divide-y">
                  {uniqueIncidents
                    .filter(incident => incident.incident_type === type)
                    .map((incident, index) => (
                      <IncidentCard 
                        key={incident.incident_uid || index} 
                        incident={incident}
                        onCaseSelect={onCaseSelect}
                      />
                    ))}
                </div>
              </TabsContent>
            ))}

            {officer.postHistory?.length > 0 && (
              <TabsContent value="employment" className="m-0">
                <div className="divide-y">
                  {_.orderBy(officer.postHistory, ['start_date'], ['desc']).map((post, index) => (
                    <PostHistoryCard key={index} post={post} />
                  ))}
                </div>
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
};