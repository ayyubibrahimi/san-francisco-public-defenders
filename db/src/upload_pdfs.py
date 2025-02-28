import os
import pandas as pd
from supabase import create_client, Client
import hashlib
import time
from tqdm import tqdm
import mimetypes

# Initialize Supabase client - IMPORTANT: Use the service role key, not the anon key
supabase_url = "https://mznepgyivrihcucwpcur.supabase.co"
supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bmVwZ3lpdnJpaGN1Y3dwY3VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjQ3Njc3NSwiZXhwIjoyMDUyMDUyNzc1fQ.9CdlpUKrc41bKsMIYIUZu5OeT2np4uuCs4EqA8nqjtU"

if not supabase_url or not supabase_key:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
    print("Please set them with:")
    print("export SUPABASE_URL=your_supabase_url")
    print("export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
    exit(1)

supabase = create_client(supabase_url, supabase_key)

# Constants
CSV_PATH = "../data/output/processed_index_with_sha1.csv"
BUCKET_NAME = "pdfs"

def create_mappings_from_csv():
    """
    Creates mappings in the pdf_mappings table for PDFs uploaded to Supabase Storage.
    Uses the SHA1 values from the CSV file and constructs the appropriate URLs.
    """
    print(f"Loading CSV from {CSV_PATH}")
    try:
        # Load CSV with SHA1 and file paths
        df = pd.read_csv(CSV_PATH)
        
        # Check required columns
        required_columns = ["local_pdf_path", "sha1"]
        for col in required_columns:
            if col not in df.columns:
                print(f"Error: Required column '{col}' not found in CSV")
                return
        
        # Filter out invalid SHA1s
        valid_records = df[~df["sha1"].str.startswith(("FILE_NOT_FOUND", "ERROR"))].copy()
        print(f"Found {len(valid_records)} valid records with SHA1 values")
        
        # Update database for each file
        success_count = 0
        error_count = 0
        
        print(f"Creating mappings for {len(valid_records)} files...")
        for index, row in tqdm(valid_records.iterrows(), total=len(valid_records)):
            file_path = row["local_pdf_path"]
            sha1 = row["sha1"]
            
            # Construct URL for the PDF in Supabase Storage
            # Format: https://[project_ref].[supabase_domain]/storage/v1/object/public/[bucket_name]/[sha1].pdf
            url = f"{supabase_url}/storage/v1/object/public/{BUCKET_NAME}/{sha1}.pdf"
            
            try:
                # Add mapping to the pdf_mappings table
                result = supabase.table("pdf_mappings").upsert({
                    "sha1": sha1,
                    "url": url,
                    "original_path": file_path,
                    "uploaded_at": time.strftime('%Y-%m-%dT%H:%M:%SZ')
                }).execute()
                
                success_count += 1
                if index % 100 == 0:  # Print status every 100 records
                    print(f"Progress: {index+1}/{len(valid_records)} records processed")
                
            except Exception as e:
                print(f"Error creating mapping for {sha1}: {e}")
                error_count += 1
        
        print(f"\nMapping creation complete!")
        print(f"Successfully created: {success_count} mappings")
        print(f"Failed: {error_count} mappings")
        
    except Exception as e:
        print(f"Error processing CSV: {e}")

def verify_mappings():
    """
    Verifies that the PDF mappings are correctly set up.
    Checks a few sample records to confirm they exist in storage.
    """
    try:
        # Get all mappings from database
        result = supabase.table("pdf_mappings").select("sha1, url").limit(10).execute()
        sample_records = result.data
        
        if not sample_records:
            print("No mappings found in database")
            return
            
        print(f"Verifying {len(sample_records)} sample mappings...")
        
        for record in sample_records:
            sha1 = record["sha1"]
            url = record["url"]
            
            print(f"SHA1: {sha1}")
            print(f"URL: {url}")
            
            # Check if file exists in storage
            try:
                file_exists = supabase.storage.from_(BUCKET_NAME).list()
                file_found = any(file["name"] == f"{sha1}.pdf" for file in file_exists)
                
                if file_found:
                    print(f"✓ File exists in storage: {sha1}.pdf")
                else:
                    print(f"✗ File not found in storage: {sha1}.pdf")
            except Exception as e:
                print(f"Error checking file existence: {e}")
            
            print("-" * 30)
        
    except Exception as e:
        print(f"Error verifying mappings: {e}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create PDF mappings after manual upload")
    parser.add_argument("--verify", action="store_true", help="Verify existing mappings")
    args = parser.parse_args()
    
    if args.verify:
        verify_mappings()
    else:
        create_mappings_from_csv()