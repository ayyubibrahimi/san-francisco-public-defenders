import { SupabaseClient } from '@supabase/supabase-js';

// Document metadata type definition
export interface DocumentMetadata {
  incident_id: string;
  incident_type: string;
  incident_date: string | null;
  source: string | null;
  officer_name: string | null;
  star_no: string | null;
  officer_agency: string | null;
  uid: string;
  post_uid: string | null;
  ois_details: string | null;
  incident_details: string | null;
}

// Generic fetch function type
export async function fetchAllRecords<T, V extends string | number = string>(
    table: string, 
    supabaseClient: SupabaseClient,
    filter?: { column: string, values: V[] }
  ): Promise<T[]> {
    let allData: T[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      let query = supabaseClient
        .from(table)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      // Apply filter if provided
      if (filter && filter.values.length > 0) {
        query = query.in(filter.column, filter.values);
      }
      
      const { data, error } = await query;
        
      if (error) throw error;
      
      if (!data || data.length < pageSize) {
        hasMore = false;
      }
      
      if (data) {
        allData = [...allData, ...(data as T[])];
      }
      
      page++;
    }
    
    return allData;
  }