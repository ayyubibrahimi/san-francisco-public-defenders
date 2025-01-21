import React from 'react';
import { Card, CardContent } from '@/components/ui/base/card';
import { Button } from '@/components/ui/base/button';
import { ScrollArea } from '@/components/ui/base/scroll-area';
import { Badge } from '@/components/ui/base/badge';
import { ArrowLeft, Shield, User } from 'lucide-react';
import { Case } from '../../types/case';
import _ from 'lodash';

interface CaseProfileProps {
  case: Case | null;
  onBack: () => void;
  onOfficerSelect: (uid: string) => void;
}

export const CaseProfile: React.FC<CaseProfileProps> = ({ 
  case: caseData, 
  onBack,
  onOfficerSelect
}) => {
  if (!caseData) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <Button
          onClick={onBack}
          variant="ghost"
          className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Case List
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p>Case data not available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use lodash to get unique officers by uid
  const uniqueOfficers = _.uniqBy(caseData.officers, 'uid');

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <Button
        onClick={onBack}
        variant="ghost"
        className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Case List
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
                  <h1 className="text-2xl font-semibold mb-1">
                    Case #{caseData.incident_id}
                  </h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{new Date(caseData.incident_date).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="capitalize">{caseData.incident_type}</span>
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="text-base px-4 py-1">
                {uniqueOfficers.length} Officer{uniqueOfficers.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Incident Details</h2>
              <ScrollArea className="h-[300px]">
                <p className="whitespace-pre-wrap">{caseData.incident_details}</p>
                {caseData.ois_details && (
                  <>
                    <h3 className="text-lg font-semibold mt-4 mb-2">Additional Details</h3>
                    <p className="whitespace-pre-wrap">{caseData.ois_details}</p>
                  </>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Officers Involved</h2>
              <ScrollArea className="h-[300px]">
                <div className="space-y-4">
                  {uniqueOfficers.map((officer) => (
                    <div
                      key={officer.uid}
                      className="p-4 rounded-lg bg-muted hover:bg-accent cursor-pointer"
                      onClick={() => onOfficerSelect(officer.uid)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-background rounded-lg">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-medium">{officer.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {officer.agency}
                            {officer.starNo && ` • Star #${officer.starNo}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};