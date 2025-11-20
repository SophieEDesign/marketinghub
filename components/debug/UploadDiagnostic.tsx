"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function UploadDiagnostic() {
  const [results, setResults] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (message: string) => {
    setResults((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testUpload = async () => {
    setTesting(true);
    setResults([]);
    
    addResult("🔍 Starting upload diagnostic...");
    
    // Test 1: Check if bucket exists
    addResult("📦 Test 1: Checking if 'attachments' bucket exists...");
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        addResult(`❌ Error listing buckets: ${bucketsError.message}`);
        addResult(`   Code: ${bucketsError.statusCode || 'N/A'}`);
        setTesting(false);
        return;
      }
      
      const attachmentsBucket = buckets?.find((b) => b.id === "attachments");
      
      if (!attachmentsBucket) {
        addResult("❌ 'attachments' bucket NOT FOUND");
        addResult("   → SOLUTION: Create bucket in Supabase Dashboard → Storage → New bucket");
        addResult("   → Name: 'attachments', Enable 'Public bucket'");
        setTesting(false);
        return;
      }
      
      addResult(`✅ Bucket exists: ${attachmentsBucket.name}`);
      addResult(`   Public: ${attachmentsBucket.public ? 'Yes' : 'No'}`);
      addResult(`   Created: ${attachmentsBucket.created_at}`);
    } catch (err: any) {
      addResult(`❌ Exception checking bucket: ${err.message}`);
      setTesting(false);
      return;
    }
    
    // Test 2: Try to list files (tests SELECT permission)
    addResult("\n📋 Test 2: Testing SELECT permission (list files)...");
    try {
      const { data: files, error: listError } = await supabase.storage
        .from("attachments")
        .list("", { limit: 1 });
      
      if (listError) {
        addResult(`❌ SELECT permission DENIED: ${listError.message}`);
        addResult(`   Code: ${listError.statusCode || 'N/A'}`);
        addResult("   → SOLUTION: Make bucket public OR add SELECT RLS policy");
      } else {
        addResult("✅ SELECT permission OK");
      }
    } catch (err: any) {
      addResult(`❌ Exception testing SELECT: ${err.message}`);
    }
    
    // Test 3: Try to upload a small test file (tests INSERT permission)
    addResult("\n📤 Test 3: Testing INSERT permission (upload test file)...");
    try {
      const testFileName = `test-${Date.now()}.txt`;
      const testPath = `test/${testFileName}`;
      const testContent = new Blob(["Test upload"], { type: "text/plain" });
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(testPath, testContent, {
          contentType: "text/plain",
          upsert: false,
        });
      
      if (uploadError) {
        addResult(`❌ INSERT permission DENIED: ${uploadError.message}`);
        addResult(`   Code: ${uploadError.statusCode || 'N/A'}`);
        
        if (uploadError.message.includes("Bucket not found")) {
          addResult("   → SOLUTION: Create 'attachments' bucket");
        } else if (uploadError.message.includes("RLS") || uploadError.message.includes("row-level security")) {
          addResult("   → SOLUTION: Make bucket public OR add INSERT RLS policy");
        } else if (uploadError.message.includes("403") || uploadError.message.includes("Forbidden")) {
          addResult("   → SOLUTION: Check bucket permissions in Supabase Dashboard");
        }
      } else {
        addResult("✅ INSERT permission OK");
        addResult(`   Uploaded: ${uploadData.path}`);
        
        // Clean up test file
        addResult("\n🧹 Cleaning up test file...");
        const { error: deleteError } = await supabase.storage
          .from("attachments")
          .remove([testPath]);
        
        if (deleteError) {
          addResult(`⚠️ Could not delete test file: ${deleteError.message}`);
        } else {
          addResult("✅ Test file deleted");
        }
      }
    } catch (err: any) {
      addResult(`❌ Exception testing INSERT: ${err.message}`);
    }
    
    // Test 4: Check Supabase client configuration
    addResult("\n⚙️ Test 4: Checking Supabase client configuration...");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl) {
      addResult("❌ NEXT_PUBLIC_SUPABASE_URL not set");
    } else {
      addResult(`✅ Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
    }
    
    if (!supabaseKey) {
      addResult("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not set");
    } else {
      addResult(`✅ Supabase Key: ${supabaseKey.substring(0, 20)}...`);
    }
    
    addResult("\n✅ Diagnostic complete!");
    addResult("\n📝 SUMMARY:");
    addResult("   - If bucket not found → Create it in Supabase Dashboard");
    addResult("   - If permissions denied → Make bucket public OR add RLS policies");
    addResult("   - If all tests pass → Upload should work in the app");
    
    setTesting(false);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-heading text-brand-blue mb-4">Upload Diagnostic Tool</h2>
      
      <button
        onClick={testUpload}
        disabled={testing}
        className="btn-primary mb-4 disabled:opacity-50"
      >
        {testing ? "Testing..." : "Run Diagnostic"}
      </button>
      
      {results.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-96 overflow-y-auto">
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {results.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}

