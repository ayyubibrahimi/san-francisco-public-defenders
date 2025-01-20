import React from 'react';
import { Badge } from '@/components/ui/base/badge';
import { AlertCircle, Shield, Search, UserX, Scale } from 'lucide-react';
import { formatDate } from '../../../lib/utils';
import { Incident } from '../../types/officer';
import { getIncidentVariant } from '../../types/incident';

interface IncidentCardProps {
  incident: Incident;
  onCaseSelect?: (incidentId: string) => void;
}

const getIncidentIcon = (type: string) => {
  switch (type) {
    case 'firearm':
    case 'gbi':
    case 'excessive force':
      return <Shield className="h-5 w-5 text-destructive" />;
    case 'unlawful search/arrest':
      return <Search className="h-5 w-5 text-muted-foreground" />;
    case 'prejudice or discrimination':
    case 'sexual assault':
      return <UserX className="h-5 w-5 text-destructive" />;
    case 'dishonesty':
      return <Scale className="h-5 w-5 text-muted-foreground" />;
    default:
      return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
  }
};

export const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onCaseSelect }) => {
  const incidentType = incident.incident_type || 'unknown';
  
  return (
    <div 
      className={`p-6 ${onCaseSelect ? 'hover:bg-accent cursor-pointer transition-colors' : ''}`}
      onClick={() => onCaseSelect && onCaseSelect(incident.incident_id)}
    >
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-muted rounded-lg">
              {getIncidentIcon(incidentType)}
            </div>
            <div>
              <h3 className="font-semibold capitalize mb-1">{incidentType}</h3>
              <div className="text-sm text-muted-foreground">
                {formatDate(incident.incident_date)}
              </div>
            </div>
          </div>
          <div className="grid gap-2 text-sm">
            <div>
              <span className="font-medium">Source:</span>{" "}
              <span className="text-muted-foreground capitalize">{incident.source}</span>
            </div>
            <div>
              <span className="font-medium">Incident ID:</span>{" "}
              <span className="text-muted-foreground">{incident.incident_id}</span>
            </div>
            {incident.incident_details && (
              <div>
                <span className="font-medium">Incident Details:</span>{" "}
                <span className="text-muted-foreground">{incident.incident_details}</span>
              </div>
            )}
            {incident.ois_details && (
              <div>
                <span className="font-medium">OIS Details:</span>{" "}
                <span className="text-muted-foreground">{incident.ois_details}</span>
              </div>
            )}
          </div>
        </div>
        <Badge
          variant={getIncidentVariant(incidentType)}
          className="h-fit"
        >
          {incidentType}
        </Badge>
      </div>
    </div>
  );
};