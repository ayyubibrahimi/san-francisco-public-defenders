import React from 'react';
import { Card, CardContent } from '@/components/ui/base/card';
import { Button } from '@/components/ui/base/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/base/tabs';
import { ScrollArea } from '@/components/ui/base/scroll-area';
import { Badge } from '@/components/ui/base/badge';
import { ArrowLeft, Shield } from 'lucide-react';
import { Officer } from '../../types/officer';
import { IncidentCard } from './IncidentCard';

interface OfficerProfileProps {
  officer: Officer | null;
  onBack: () => void;
  onCaseSelect: (incidentId: string) => void;
}

export const OfficerProfile: React.FC<OfficerProfileProps> = ({ 
  officer, 
  onBack,
  onCaseSelect
}) => {
  const uniqueIncidentTypes = React.useMemo(() => {
    if (!officer) return [];
    const types = new Set(officer.incidents.map(incident => incident.incident_type));
    return Array.from(types).filter(Boolean).sort();
  }, [officer]); // Changed dependency to just 'officer' since it includes everything we need

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
                        <span>Star #{officer.starNo}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-base px-4 py-1">
                  {officer.incidents.length} Incident{officer.incidents.length !== 1 ? 's' : ''}
                </Badge>
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
          </TabsList>

          <ScrollArea className="h-[600px] rounded-lg border bg-card">
            <TabsContent value="all" className="m-0">
              <div className="divide-y">
                {officer.incidents.map((incident, index) => (
                  <IncidentCard 
                    key={incident.incident_id || index} 
                    incident={incident}
                    onCaseSelect={onCaseSelect}
                  />
                ))}
              </div>
            </TabsContent>

            {uniqueIncidentTypes.map(type => (
              <TabsContent key={type} value={type} className="m-0">
                <div className="divide-y">
                  {officer.incidents
                    .filter(incident => incident.incident_type === type)
                    .map((incident, index) => (
                      <IncidentCard 
                        key={incident.incident_id || index} 
                        incident={incident}
                        onCaseSelect={onCaseSelect}
                      />
                    ))}
                </div>
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
};