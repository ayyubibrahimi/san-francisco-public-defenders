export interface Incident {
    incident_id: string;
    incident_type: string;
    incident_date: string;
    source: string;
    officer_name: string;
    star_no: number | null;
    officer_agency: string;
    uid: string;
    ois_details: string;
    incident_details: string;
  }
  
  export interface Officer {
    uid: string;
    name: string;
    starNo: number | null;
    agency: string;
    incidentCount: number;
    incidents: Incident[];
  }