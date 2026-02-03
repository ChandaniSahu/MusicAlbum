// "use client";

// export default function BulkUploadButton() {
//   const handleBulkUpload = async () => {
//     try {
//       const res = await fetch("/api/upload", {
//         method: "POST",
//       });

//       const data = await res.json();
//       console.log(data);
//       alert("Bulk upload completed");
//     } catch (err) {
//       console.error(err);
//       alert("Bulk upload failed");
//     }
//   };

//   return (
//     <button onClick={handleBulkUpload}>
//       Bulk Upload Songs
//     </button>
//   );
// }

"use client";

import { useState } from "react";

export default function BulkUploadButton() {
  const [result, setResult] = useState({success:0 , failed:0});

  const handleBulkUpload = async () => {
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
      });

      const data = await res.json();
      console.log(data);

      setResult({
        success: data.successCount ?? 0,
        failed: data.failureCount ?? 0,
      });

      alert(
        `Bulk upload completed ✅\n` +
        `Successful: ${data.successCount ?? 0}\n` +
        `Failed: ${data.failureCount ?? 0}`
      );
      console.log('result',data)
    } catch (err) {
      console.error(err);
      alert("Bulk upload failed ❌");
    }
  };

  return (
    <div>
      <button onClick={handleBulkUpload}>
        Bulk Upload Songs
      </button>

      {result && (
        <div style={{ marginTop: "10px" }}>
          <p>✅ Uploaded Successfully: {result.success}</p>
          <p>❌ Failed Uploads: {result.failed}</p>
        </div>
      )}
    </div>
  );
}
