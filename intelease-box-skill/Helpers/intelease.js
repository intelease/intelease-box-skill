const request = require('request');

const FILES_API = 'https://app.intelease.com/boxApi/v1/uploadBoxFile';

/**
 * Class for sending data to InteLease
 */
class Intelease {
  /**
   * Initialize the access token for InteLease OAuth2.0 API
   */
  constructor() {
    this.itlsAuthToken = `${process.env.INTELEASE_AUTH_TOKEN}`;
  }

  /**
   * Upload the file to InteLease.
   *
   * @param filesReader - the FilesReader object for this file
   * @param base64EncodedFile - the actual file, in base 64
   * @param keyValues - the metadata associated with the file, to send to InteLease
   * @returns {Promise<any>} - the promise of sending the file to InteLease
   */
  async uploadFileToIntelease(filesReader, base64EncodedFile, keyValues) {
    const fileName = filesReader.fileName;
    const decodedFile = new Buffer(base64EncodedFile, 'base64');

    const thisFormData = {
      file: {
        value: decodedFile,
        options: {
          filename: fileName,
          contentType: 'application/pdf'
        }
      }
    };
    const thisKeys = Object.keys(keyValues);
    for (let idx = 0; idx < thisKeys.length; idx++) {
      const thisKey = thisKeys[idx];
      thisFormData[thisKey] = keyValues[thisKey];
    }

    const reqOptions = {
      method: 'POST',
      url: FILES_API,
      headers: {
        'Content-Type': 'multipart/form-data',
        'Access-Control-Allow-Origin': '*',
        'Authorization': `Bearer ${this.itlsAuthToken}`
      },
      formData: thisFormData
    };

    return new Promise((resolve, reject) => {
      let r = request(reqOptions, function(error, response, body) {
        if (error) {
          reject(error);
        }
        resolve(JSON.parse(body));
      });
    });
  }
}

module.exports = Intelease;
