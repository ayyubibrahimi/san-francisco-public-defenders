import React from 'react';
import { Card, CardContent } from '@/components/ui/base/card';
import { Badge } from '@/components/ui/base/badge';
import { Calendar, ChevronRight } from 'lucide-react';
import { Case } from '../../types/case';
import _ from 'lodash';

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
}) => {
  // Get unique officers by uid
  const uniqueOfficers = _.uniqBy(caseData.officers, 'uid');
  
  // Format date
  const formattedDate = new Date(caseData.incident_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Simplify ID for display
  const displayId = caseData.incident_id.startsWith('#') 
    ? caseData.incident_id 
    : `#${caseData.incident_id}`;
  
  // Extract incident summary (if available)
  const incidentSummary = caseData.ois_details
    ? caseData.ois_details.substring(0, 60) + (caseData.ois_details.length > 60 ? '...' : '')
    : 'No details available';

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors border-gray-200"
      onClick={() => onClick(caseData)}
    >
      <CardContent className="p-0">
        {/* Top section with ID and badge */}
        <div className="p-4 pb-2 flex items-center justify-between">
          <div className="font-medium text-base">{displayId}</div>
          <Badge 
            variant="outline" 
            className="capitalize text-xs bg-gray-100"
          >
            {caseData.incident_type}
          </Badge>
        </div>
        
        {/* Date information */}
        <div className="px-4 pb-3 text-xs text-gray-500 flex items-center">
          <Calendar className="h-3 w-3 mr-1" />
          {formattedDate}
        </div>
        
        {/* Incident details (if available) */}
        <div className="px-4 pb-3">
          <p className="text-sm line-clamp-2 text-gray-700">
            {incidentSummary}
          </p>
        </div>
        
        {/* Officer information */}
        <div className="px-4 pb-3">
          {uniqueOfficers.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {uniqueOfficers.slice(0, 2).map(officer => (
                <div key={officer.uid} className="flex items-center text-xs">
                  <div className="w-4 h-4 rounded-full bg-gray-200 flex-shrink-0 mr-1"></div>
                  <span className="truncate font-medium">{officer.name}</span>
                </div>
              ))}
              {uniqueOfficers.length > 2 && (
                <div className="text-xs text-gray-500">+{uniqueOfficers.length - 2} more</div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500">No officers available</div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-100 p-2 text-xs flex justify-end text-primary">
          <div className="flex items-center">
            View details
            <ChevronRight className="h-3 w-3 ml-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};