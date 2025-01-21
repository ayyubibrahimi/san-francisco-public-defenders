import pandas as pd
from supabase import create_client
import os
from typing import List, Dict, Any
import logging
from tqdm import tqdm

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SupabaseUploader:
    def __init__(self, supabase_url: str, supabase_key: str):
        """Initialize Supabase client"""
        self.supabase = create_client(supabase_url, supabase_key)
        
    def read_csv(self, file_path: str) -> pd.DataFrame:
        """Read CSV file into a pandas DataFrame"""
        try:
            df = pd.read_csv(file_path, dtype={
                'sha1': str,
                'page_number': str,
                'model_name': str,
                'embeddings': str,
            })
            
            required_columns = ['sha1', 'page_number', 'model_name', 'embeddings']
            
            missing_cols = [col for col in required_columns if col not in df.columns]
            if missing_cols:
                raise ValueError(f"Missing required columns: {missing_cols}")
            
            # Convert all columns to string type explicitly
            for col in required_columns:
                df[col] = df[col].astype(str)
            
            # Remove any leading/trailing whitespace
            df = df.apply(lambda x: x.str.strip() if x.dtype == "object" else x)
            
            return df
            
        except Exception as e:
            logger.error(f"Error reading CSV file: {e}")
            raise

    def process_batch(self, records: List[Dict[str, Any]]) -> None:
        """Upload a batch of records to Supabase"""
        try:
            cleaned_records = []
            for record in records:
                cleaned_record = {
                    'sha1': str(record['sha1']),
                    'page_number': str(record['page_number']),
                    'model_name': str(record['model_name']), 
                    'embeddings': str(record['embeddings']),
                }
                cleaned_records.append(cleaned_record)

            response = self.supabase.table('document_page_embeddings').upsert(
                cleaned_records
            ).execute()
            
            if hasattr(response, 'data'):
                logger.info(f"Successfully uploaded batch of {len(cleaned_records)} records")
            else:
                logger.warning("Upload completed but no response data returned")
                
        except Exception as e:
            logger.error(f"Error uploading batch to Supabase: {str(e)}")
            raise

    def upload_csv(self, file_path: str, batch_size: int = 500) -> None:
        """Main function to process and upload CSV data"""
        try:
            logger.info(f"Starting to process {file_path}")
            
            df = self.read_csv(file_path)
            total_records = len(df)
            total_batches = (total_records + batch_size - 1) // batch_size
            logger.info(f"Found {total_records} records to process in {total_batches} batches")
            
            # Process in batches
            with tqdm(total=total_batches, desc="Uploading batches") as pbar:
                for i in range(0, total_records, batch_size):
                    batch_df = df.iloc[i:i + batch_size]
                    batch_records = batch_df.to_dict('records')
                    try:
                        self.process_batch(batch_records)
                        pbar.update(1)
                    except Exception as e:
                        logger.error(f"Error processing batch starting at index {i}: {str(e)}")
                        raise
                
            logger.info("Upload completed successfully")
            
        except Exception as e:
            logger.error(f"Error in upload process: {str(e)}")
            raise

def main():
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')

    uploader = SupabaseUploader(supabase_url, supabase_key)
    
    try:
        uploader.upload_csv('../data/input/document_page_embeddings.csv')
    except Exception as e:
        logger.error(f"Failed to upload CSV: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()