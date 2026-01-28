"use client";

export default function BulkUploadButton() {
  const handleBulkUpload = async () => {
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
      });

      const data = await res.json();
      console.log(data);
      alert("Bulk upload completed");
    } catch (err) {
      console.error(err);
      alert("Bulk upload failed");
    }
  };

  return (
    <button onClick={handleBulkUpload}>
      Bulk Upload Songs
    </button>
  );
}
