export type IncidentType = 
  | 'firearm'
  | 'gbi'
  | 'excessive force'
  | 'unlawful search/arrest'
  | 'prejudice or discrimination'
  | 'dishonesty'
  | 'sexual assault'
  | 'in custody death'
  | 'unknown';

export const getIncidentVariant = (type: string): "destructive" | "secondary" | "warning" => {
  switch (type) {
    case 'firearm':
    case 'sexual assault':
    case 'in custody death':
      return 'destructive';
    case 'gbi':
    case 'excessive force':
      return 'warning';
    default:
      return 'secondary';
  }
};