import os
import pandas as pd
import hashlib
import time
import shutil
from tqdm import tqdm
import sys
import csv

# Constants
CSV_PATH = "../data/output/processed_index_with_sha1.csv"
OUTPUT_DIR = "../data/output/renamed_pdfs_for_upload"

def prepare_files_for_manual_upload():
    """
    Prepares files for manual upload by copying them to a new directory
    with their SHA1 as the filename.
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
        
        # Create output directory
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        # Prepare export CSV for mappings
        mappings_file = os.path.join(OUTPUT_DIR, "pdf_mappings.csv")
        with open(mappings_file, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['sha1', 'original_path', 'new_filename', 'file_size'])
        
        # Copy files with SHA1 as filename
        success_count = 0
        error_count = 0
        
        print(f"Processing {len(df)} files...")
        for index, row in tqdm(df.iterrows(), total=len(df)):
            file_path = row["local_pdf_path"]
            sha1 = row["sha1"]
            
            # Skip if SHA1 indicates file not found or error
            if isinstance(sha1, str) and sha1.startswith(("FILE_NOT_FOUND", "ERROR")):
                print(f"Skipping {file_path}: {sha1}")
                error_count += 1
                continue
                
            # Verify file exists
            if not os.path.isfile(file_path):
                print(f"File not found: {file_path}")
                error_count += 1
                continue
            
            # New filename with SHA1
            new_filename = f"{sha1}.pdf"
            new_path = os.path.join(OUTPUT_DIR, new_filename)
            
            try:
                # Copy file
                shutil.copy2(file_path, new_path)
                
                # Get file size
                file_size = os.path.getsize(new_path)
                
                # Update mappings CSV
                with open(mappings_file, 'a', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow([sha1, file_path, new_filename, file_size])
                
                success_count += 1
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
                error_count += 1
        
        print(f"\nProcessing complete!")
        print(f"Successfully processed: {success_count} files")
        print(f"Failed: {error_count} files")
        print(f"\nFiles have been copied to: {OUTPUT_DIR}")
        print(f"CSV mapping file created at: {mappings_file}")
        print("\nInstructions for manual upload:")
        print("1. Go to your Supabase dashboard > Storage > 'pdfs' bucket")
        print("2. Upload all the renamed PDF files from the output directory")
        print("3. After uploading, run the 'update_db_after_manual_upload.py' script to update the database")
        
    except Exception as e:
        print(f"Error processing CSV: {e}")

def update_db_after_manual_upload():
    """
    Updates the database with mappings after manual upload.
    """
    from supabase import create_client, Client
    
    # Initialize Supabase client
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        print("Please set them with:")
        print("export SUPABASE_URL=your_supabase_url")
        print("export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Load mappings
    mappings_file = os.path.join(OUTPUT_DIR, "pdf_mappings.csv")
    if not os.path.exists(mappings_file):
        print(f"Error: Mappings file not found at {mappings_file}")
        return
    
    df_mappings = pd.read_csv(mappings_file)
    
    # Update database
    success_count = 0
    error_count = 0
    
    print(f"Updating database with {len(df_mappings)} mappings...")
    for index, row in tqdm(df_mappings.iterrows(), total=len(df_mappings)):
        sha1 = row["sha1"]
        original_path = row["original_path"]
        file_size = row["file_size"]
        
        # Construct URL
        url = f"{supabase_url}/storage/v1/object/public/pdfs/{sha1}.pdf"
        
        try:
            # Update database
            result = supabase.table("pdf_mappings").upsert({
                "sha1": sha1,
                "url": url,
                "original_path": original_path,
                "file_size": file_size,
                "uploaded_at": time.strftime('%Y-%m-%dT%H:%M:%SZ')
            }).execute()
            
            success_count += 1
        except Exception as e:
            print(f"Error updating database for {sha1}: {e}")
            error_count += 1
    
    print(f"\nDatabase update complete!")
    print(f"Successfully updated: {success_count} records")
    print(f"Failed: {error_count} records")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "update_db":
        update_db_after_manual_upload()
    else:
        prepare_files_for_manual_upload()