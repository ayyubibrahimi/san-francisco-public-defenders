import React from 'react';
import { Card, CardContent } from '@/components/ui/base/card';
import { Badge } from '@/components/ui/base/badge';
import { Shield } from 'lucide-react';
import { Case } from '../../types/case';

interface CaseCardProps {
  case: Case;
  onClick: (caseData: Case) => void;
  searchResults?: Array<{
    incident_id: string;
    matchingText: string[];
    pageNumbers: number[];
  }>;
}

export const CaseCard: React.FC<CaseCardProps> = ({ 
  case: caseData, 
  onClick,
  searchResults 
}) => {
  // Find matching text snippets if they exist
  const searchMatches = searchResults?.find(r => r.incident_id === caseData.incident_id);

  return (
    <Card 
      className="hover:bg-accent cursor-pointer transition-colors"
      onClick={() => onClick(caseData)}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-muted rounded-lg">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-semibold">Case #{caseData.incident_id}</h3>
              <Badge variant="secondary" className="capitalize">
                {caseData.incident_type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(caseData.incident_date).toLocaleDateString()}
            </p>
            <div className="mt-2">
              <p className="text-sm text-muted-foreground">
                {caseData.officers.length} Officer{caseData.officers.length !== 1 ? 's' : ''} Involved
              </p>
            </div>
            
            {searchMatches && searchMatches.matchingText.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchMatches.matchingText.map((text, index) => (
                  <div key={index} className="text-sm bg-muted p-2 rounded">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Page {searchMatches.pageNumbers[index]}: </span>
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};