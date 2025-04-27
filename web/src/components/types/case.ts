export interface Case {
    incident_id: string;
    incident_type: string;
    incident_date: string;
    incident_year: string;
    receive_date: string;
    officers: {
      uid: string;
      name: string;
      starNo: number | null;
      agency: string;
    }[];
    source: string;
    ois_details: string;
    incident_details: string;
  }
  