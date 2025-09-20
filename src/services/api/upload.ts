import debug from '../../utils/debug';

export async function uploadProfileImage(file: File): Promise<any> {
  const token = localStorage.getItem("authToken");
  
  debug.info('Uploading profile image:', { 
    filename: file.name, 
    type: file.type, 
    size: file.size 
  });
  
  // Create FormData for multipart upload following GraphQL multipart request spec
  const formData = new FormData();
  
  // The operations part describes the GraphQL query and where to inject the file
  const operations = {
    query: `
      mutation UploadProfileImage($image: Upload!) {
        UploadProfileImage(image: $image) {
          id
          firstname
          lastname
          username
          language
          email
          profileImageUrl
        }
      }
    `,
    variables: {
      image: null // This will be replaced by the file
    },
    operationName: "UploadProfileImage"
  };
  
  // The map tells the server where to inject the file
  const map = {
    "0": ["variables.image"]
  };
  
  // Append the parts in the exact order expected by GraphQL multipart spec
  formData.append('operations', JSON.stringify(operations));
  formData.append('map', JSON.stringify(map));
  formData.append('0', file, file.name); // '0' corresponds to the key in the map
  
  try {
    // @ts-ignore
    const response = await fetch(global.config.graphql_host, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let the browser set it with the boundary for multipart/form-data
      },
      body: formData
    });
    
    debug.info('Upload response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      debug.error('Upload failed with status:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    debug.info('Upload response:', result);
    
    if (result.errors && result.errors.length > 0) {
      debug.error('GraphQL errors:', result.errors);
      throw new Error(result.errors[0]?.message || 'Upload failed with GraphQL errors');
    }
    
    if (!result.data || !result.data.UploadProfileImage) {
      debug.error('No data returned from upload:', result);
      throw new Error('No data returned from upload');
    }
    
    debug.success('Profile image uploaded successfully');
    return result.data.UploadProfileImage;
  } catch (error) {
    debug.error('Profile image upload failed:', error);
    throw error;
  }
}