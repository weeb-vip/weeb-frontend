import debug from './debug';

// Test function to help debug upload issues
export async function testUploadFormat(): Promise<void> {
  const token = localStorage.getItem("authToken");
  
  if (!token) {
    debug.error('No auth token found for upload test');
    return;
  }

  // Create a tiny test image (1x1 red pixel PNG)
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, 0, 1, 1);
  }

  canvas.toBlob(async (blob) => {
    if (!blob) {
      debug.error('Failed to create test blob');
      return;
    }

    const file = new File([blob], 'test.png', { type: 'image/png' });
    
    debug.info('Testing upload with file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    const formData = new FormData();
    
    const operations = {
      query: `
        mutation UploadProfileImage($image: Upload!) {
          UploadProfileImage(image: $image) {
            id
            profileImageUrl
          }
        }
      `,
      variables: { image: null },
      operationName: "UploadProfileImage"
    };
    
    const map = { "0": ["variables.image"] };
    
    formData.append('operations', JSON.stringify(operations));
    formData.append('map', JSON.stringify(map));
    formData.append('0', file);

    try {
      // @ts-ignore
      const response = await fetch(global.config.graphql_host, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });

      debug.info('Test upload response status:', response.status);
      debug.info('Test upload response headers:', Object.fromEntries(response.headers.entries()));
      
      const text = await response.text();
      debug.info('Test upload response body:', text);
      
      try {
        const json = JSON.parse(text);
        debug.info('Test upload parsed response:', json);
      } catch (e) {
        debug.error('Failed to parse response as JSON:', e);
      }
    } catch (error) {
      debug.error('Test upload failed:', error);
    }
  }, 'image/png');
}

// Call this function from the console to test: window.testUpload()
if (typeof window !== 'undefined') {
  (window as any).testUpload = testUploadFormat;
}