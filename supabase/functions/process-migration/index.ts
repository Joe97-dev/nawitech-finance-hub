import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MigrationRequest {
  jobId: string;
}

interface MigrationJob {
  id: string;
  data_type: string;
  source_file_path: string;
  mapping_config?: any;
}

interface ParsedRecord {
  [key: string]: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { jobId }: MigrationRequest = await req.json();

    console.log('Processing migration job:', jobId);

    // Get migration job details
    const { data: job, error: jobError } = await supabase
      .from('migration_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message}`);
    }

    // Update job status to processing
    await supabase
      .from('migration_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Download and parse the file
    const { data: fileData, error: fileError } = await supabase.storage
      .from('migration-files')
      .download(job.source_file_path);

    if (fileError || !fileData) {
      throw new Error(`Failed to download file: ${fileError?.message}`);
    }

    // Convert file to text
    const fileText = await fileData.text();
    
    // Parse CSV data
    const records = parseCSV(fileText);
    console.log(`Parsed ${records.length} records from file`);

    // Update total records count
    await supabase
      .from('migration_jobs')
      .update({ total_records: records.length })
      .eq('id', jobId);

    let successCount = 0;
    let failCount = 0;
    const errors: any[] = [];

    // Process records based on data type
    for (let i = 0; i < records.length; i++) {
      try {
        await processRecord(supabase, job.data_type, records[i], job.mapping_config);
        successCount++;
      } catch (error) {
        failCount++;
        errors.push({
          row: i + 1,
          data: records[i],
          error: error.message
        });
        console.error(`Error processing record ${i + 1}:`, error);
      }

      // Update progress every 10 records
      if (i % 10 === 0) {
        await supabase
          .from('migration_jobs')
          .update({
            processed_records: i + 1,
            successful_records: successCount,
            failed_records: failCount
          })
          .eq('id', jobId);
      }
    }

    // Final update
    await supabase
      .from('migration_jobs')
      .update({
        status: failCount === records.length ? 'failed' : 'completed',
        processed_records: records.length,
        successful_records: successCount,
        failed_records: failCount,
        error_summary: errors.length > 0 ? { errors: errors.slice(0, 100) } : null,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`Migration completed: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: records.length,
        successful: successCount,
        failed: failCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Migration processing error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function parseCSV(text: string): ParsedRecord[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const records: ParsedRecord[] = [];

  console.log('CSV Headers found:', headers);

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const record: ParsedRecord = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    records.push(record);
  }

  console.log('Sample record:', records[0]);
  return records;
}

async function processRecord(supabase: any, dataType: string, record: ParsedRecord, mappingConfig?: any) {
  switch (dataType) {
    case 'clients':
      await processClientRecord(supabase, record, mappingConfig);
      break;
    case 'loans':
      await processLoanRecord(supabase, record, mappingConfig);
      break;
    case 'transactions':
      await processTransactionRecord(supabase, record, mappingConfig);
      break;
    case 'all':
      // Determine record type based on data structure
      if (record.client_name || record.first_name) {
        await processClientRecord(supabase, record, mappingConfig);
      } else if (record.loan_amount || record.amount) {
        await processLoanRecord(supabase, record, mappingConfig);
      } else if (record.transaction_amount || record.payment_amount) {
        await processTransactionRecord(supabase, record, mappingConfig);
      }
      break;
    default:
      throw new Error(`Unsupported data type: ${dataType}`);
  }
}

async function processClientRecord(supabase: any, record: ParsedRecord, mappingConfig?: any) {
  console.log('Processing client record:', record);
  
  // Get all available keys in the record
  const keys = Object.keys(record);
  console.log('Available fields:', keys);
  
  // More flexible field mapping - case insensitive
  const findField = (possibleNames: string[]) => {
    for (const name of possibleNames) {
      const found = keys.find(key => key.toLowerCase().includes(name.toLowerCase()));
      if (found && record[found]) return record[found];
    }
    return null;
  };

  const clientData = {
    first_name: findField(['first', 'fname', 'firstname', 'name']) || 
               record['Client Name']?.split(' ')[0] || 
               keys[0] ? record[keys[0]] : '', // Use first column if nothing else matches
    last_name: findField(['last', 'lname', 'lastname', 'surname']) || 
              record['Client Name']?.split(' ').slice(1).join(' ') || 
              keys[1] ? record[keys[1]] : '', // Use second column as fallback
    email: findField(['email', 'mail', 'e-mail']),
    phone: findField(['phone', 'mobile', 'tel', 'telephone', 'contact']),
    id_number: findField(['id', 'national', 'identity', 'number']),
    gender: findField(['gender', 'sex']),
    address: findField(['address', 'location']),
    city: findField(['city', 'town']),
    region: findField(['region', 'state', 'county']),
    occupation: findField(['occupation', 'job', 'work']),
    employment_status: findField(['employment', 'status']),
    monthly_income: findField(['income', 'salary', 'earning']) ? 
                   parseFloat(findField(['income', 'salary', 'earning'])) : null,
    date_of_birth: findField(['birth', 'dob', 'birthday']),
    registration_date: findField(['registration', 'reg_date']) || new Date().toISOString().split('T')[0]
  };

  console.log('Mapped client data:', clientData);

  const { error } = await supabase
    .from('clients')
    .insert(clientData);

  if (error) {
    throw new Error(`Client insert error: ${error.message}`);
  }
}

async function processLoanRecord(supabase: any, record: ParsedRecord, mappingConfig?: any) {
  // First try to find the client
  let clientId = null;
  if (record.client_id) {
    clientId = record.client_id;
  } else if (record.client_name || record.Client_Name) {
    const clientName = record.client_name || record.Client_Name;
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .ilike('first_name', `%${clientName.split(' ')[0]}%`)
      .single();
    
    if (client) {
      clientId = client.id;
    }
  }

  const loanData = {
    client: record.client || record.Client || record.client_name || record.Client_Name || '',
    amount: parseFloat(record.amount || record.Amount || record.loan_amount || record.Loan_Amount || '0'),
    balance: parseFloat(record.balance || record.Balance || record.amount || record.Amount || '0'),
    interest_rate: parseFloat(record.interest_rate || record.Interest_Rate || '15'),
    term_months: parseInt(record.term_months || record.Term_Months || '12'),
    type: record.type || record.Type || record.loan_type || record.Loan_Type || 'personal',
    status: record.status || record.Status || 'active',
    frequency: record.frequency || record.Frequency || 'monthly',
    date: record.date || record.Date || new Date().toISOString().split('T')[0]
  };

  const { error } = await supabase
    .from('loans')
    .insert(loanData);

  if (error) {
    throw new Error(`Loan insert error: ${error.message}`);
  }
}

async function processTransactionRecord(supabase: any, record: ParsedRecord, mappingConfig?: any) {
  // Try to find the loan
  let loanId = null;
  if (record.loan_id) {
    loanId = record.loan_id;
  } else if (record.loan_number || record.Loan_Number) {
    const { data: loan } = await supabase
      .from('loans')
      .select('id')
      .eq('loan_number', record.loan_number || record.Loan_Number)
      .single();
    
    if (loan) {
      loanId = loan.id;
    }
  }

  if (!loanId) {
    throw new Error('Loan not found for transaction');
  }

  const transactionData = {
    loan_id: loanId,
    amount: parseFloat(record.amount || record.Amount || record.transaction_amount || record.Transaction_Amount || '0'),
    transaction_type: record.transaction_type || record.Transaction_Type || 'payment',
    payment_method: record.payment_method || record.Payment_Method || 'cash',
    receipt_number: record.receipt_number || record.Receipt_Number || null,
    notes: record.notes || record.Notes || null,
    transaction_date: record.transaction_date || record.Transaction_Date || new Date().toISOString()
  };

  const { error } = await supabase
    .from('loan_transactions')
    .insert(transactionData);

  if (error) {
    throw new Error(`Transaction insert error: ${error.message}`);
  }
}