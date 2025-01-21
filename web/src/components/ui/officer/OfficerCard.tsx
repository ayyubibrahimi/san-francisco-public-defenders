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
        <Badge className="mt-2" variant="secondary">
          {uniqueIncidentCount} Incident{uniqueIncidentCount !== 1 ? 's' : ''}
        </Badge>
      </CardContent>
    </Card>
  );
};