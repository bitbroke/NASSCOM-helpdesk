import pandas as pd
import os

input_file = r"C:\Users\M S I\Downloads\cancer_dataset\archive\aa_dataset-tickets-multi-lang-5-2-50-version.csv"
output_file = r"c:\Ankshit\NASSCOM_1\data\english_tickets.csv"

# Read the dataset
df = pd.read_csv(input_file)

# The columns are lowercase in the dataset. Let's rename them to Title Case for compatibility with instructions
df = df.rename(columns={
    'subject': 'Subject',
    'body': 'Body',
    'answer': 'Answer',
    'type': 'Type',
    'queue': 'Queue',
    'priority': 'Priority',
    'language': 'Language'
})

# Filter for English
df_en = df[df['Language'] == 'en']
print(f"Filtered down to {len(df_en)} English tickets from {len(df)} total tickets.")

# Save to output file
os.makedirs(os.path.dirname(output_file), exist_ok=True)
df_en.to_csv(output_file, index=False)
print(f"Saved to {output_file}")
