import React from 'react';
import { Card, CardContent } from '@/components/ui/base/card';
import { Badge } from '@/components/ui/base/badge';
import { Officer } from '../../types/officer';
import _ from 'lodash';

interface OfficerCardProps {
  officer: Officer;
  onClick: (officer: Officer) => void;
}

export const OfficerCard: React.FC<OfficerCardProps> = ({ officer, onClick }) => {
  // Calculate unique incident count using incident_uid
  const uniqueIncidentCount = React.useMemo(() => {
    if (!officer.incidents) return 0;
    return _.uniqBy(officer.incidents, 'incident_uid').length;
  }, [officer.incidents]);

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onClick(officer)}
    >
      <CardContent className="p-4">
        <h2 className="font-bold text-lg">{officer.name}</h2>
        {officer.starNo && <p className="text-sm text-gray-600">Star #{officer.starNo}</p>}
        <p className="text-sm text-gray-600">{officer.agency}</p>
        
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="secondary">
            {uniqueIncidentCount} Incident{uniqueIncidentCount !== 1 ? 's' : ''}
          </Badge>
          
          {officer.postHistory?.length > 0 && (
            <Badge variant="outline">
              {officer.postHistory.length} Employment Record{officer.postHistory.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {officer.serviceStartDate && (
          <p className="text-xs text-gray-500 mt-2">
            Service Start: {new Date(officer.serviceStartDate).toLocaleDateString()}
          </p>
        )}
        
        {officer.currentPost && (
          <p className="text-xs text-gray-500">
            Current: {officer.currentPost.agency_name}
          </p>
        )}
      </CardContent>
    </Card>
  );
};