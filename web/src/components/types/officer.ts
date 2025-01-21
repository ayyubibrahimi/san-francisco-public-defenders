export interface PostRecord {
  post_uid: string;
  officer_name: string;
  agency_name: string;
  start_date: string;
  end_date: string | null;
}

export interface Incident {
  incident_id: string;
  incident_type: string;
  incident_date: string;
  source: string;
  officer_name: string;
  star_no: number | null;
  officer_agency: string;
  uid: string;
  post_uid: string | null;
  ois_details: string;
  incident_details: string;
  incident_uid?: string;
}

export interface Officer {
  uid: string;
  name: string;
  starNo: number | null;
  agency: string;
  incidentCount: number;
  incidents: Incident[];
  postHistory: PostRecord[];
  currentPost: PostRecord | null;
  serviceStartDate: string | null;
}