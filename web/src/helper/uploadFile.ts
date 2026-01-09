// src/helper/uploadFile.ts
interface UploadResponse {
  url: string;
  public_id: string;
  [key: string]: any;
}

const uploadFile = async (file: File): Promise<UploadResponse> => {
  const url = `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/auto/upload`;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append("upload_preset", "gusa-gusa-file");

  const response = await fetch(url, {
    method: 'post',
    body: formData
  });

  const responseData: UploadResponse = await response.json();

  console.log('========= responseData =======');
  console.log(responseData);
  console.log('====================================');

  return responseData;
};

export default uploadFile;