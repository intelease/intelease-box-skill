'use strict';

const { FilesReader, SkillsWriter, SkillsErrorEnum } = require('./skills-kit-library/skills-kit-2.0.js');
const Intelease = require('./Helpers/intelease.js');

let skillsWriter;

/**
 * Upon trigger from Box (i.e. file is uploaded, moved, or copied), this function is called to initiate its processing.
 *
 * @param request - the request from Box (contains file info)
 * @param response - the response to return to Box
 */
exports.sendBoxFileToItls = (request, response) => {
  processSkill(request.body)
    .then(() => {
      sendResponse(response);
    });
};

/**
 * Retrieve the file information and send it to InteLease for processing.
 *
 * @param body - the body of the request sent from Box
 * @returns {Promise<void>} - the promise of sending the file info to InteLease
 */
async function processSkill(body) {
  try {
    const filesReader = new FilesReader(JSON.stringify(body));
    const fileContext = filesReader.getFileContext();
    const fileId = fileContext.fileId;
    const fileName = filesReader.fileName;
    const fileURL = fileContext.fileDownloadURL;
    skillsWriter = new SkillsWriter(fileContext);
    skillsWriter.saveProcessingCard();
    console.log('getting content base 64 for filename: ' + fileName);
    const base64File = await filesReader.getContentBase64();
    const keyValues = {};
    keyValues.boxEmail = body.event.created_by.login;
    keyValues.writeAccessToken = body.token.write.access_token;
    keyValues.readAccessToken = body.token.read.access_token;
    keyValues.skillId = body.skill.id; // equals "2058"
    keyValues.requestId = body.id;
    keyValues.fileId = body.source.id;
    await sendToIntelease(filesReader, base64File, keyValues);
  } catch(error) {
    console.log(error);
    await skillsWriter.saveErrorCard(SkillsErrorEnum.UNKNOWN);
  }
}

/**
 * Send the file info to InteLease.
 *
 * @param filesReader - the FilesReader object for this file
 * @param base64File - the actual file, in base 64
 * @param keyValues - the metadata to send to InteLease, along with the file
 * @returns {Promise<void>} - the promise of sending the data to InteLease
 */
async function sendToIntelease(filesReader, base64File, keyValues) {
  const intelease = new Intelease();
  const fileName = filesReader.fileName;
  const uploadedFile = await intelease.uploadFileToIntelease(filesReader, base64File, keyValues);
}

/**
 * This function is called by InteLease, after InteLease completes processing of a Box document.
 * It writes the structured data obtained by InteLease as Transcript cards on the Box document.
 *
 * @param request - the request from InteLease, containing abstract information
 * @param response - the response to return to InteLease
 */
exports.processItlsAbstract = (request, response) => {
  processAbstract(request.body)
      .then(() => {
        sendResponse(response);
      });
};

/**
 * This function processes the body of the request, sent from InteLease.
 * It writes the structured data obtained by InteLease as Transcript cards on the Box document.
 *
 * @param body - the body of the request sent from InteLease
 * @returns {Promise<void>} - the promise of saving the data or error cards on the Box document
 */
async function processAbstract(body) {
  try {
    const skillId = "2058";
    const boxInfo = body.boxInfo;
    skillsWriter = new SkillsWriter(boxInfo.requestId, skillId, boxInfo.fileId, boxInfo.writeAccessToken);

    // Process Intelease JSON object and attach Box Skills card as metadata
    let cards = populateMetadataCards(body.provisionGroups);

    await skillsWriter.saveDataCards(cards);
  } catch(error) {
    console.log(error);
    await skillsWriter.saveErrorCard(SkillsErrorEnum.UNKNOWN);
  }
}

/**
 * Populate the Transcript cards with data sent from InteLease.
 *
 * @param inteleaseMetadata - the structured data obtained by InteLease
 * @returns {Array} - the list of transcript cards to be written to the Box file
 */
function populateMetadataCards(inteleaseMetadata) {
  const cards = [];
  // InteLease Metadata card first
  let itlsProvisionGroup = 'InteLease Metadata';
  if (inteleaseMetadata[itlsProvisionGroup]) {
    let cardTopics = [];
    const metadata = Object.keys(inteleaseMetadata[itlsProvisionGroup]);
    for (let provIdx = 0; provIdx < metadata.length; provIdx++) {
      const provisionName = metadata[provIdx];
      if (inteleaseMetadata[itlsProvisionGroup][provisionName]) {
        const provisionValue = inteleaseMetadata[itlsProvisionGroup][provisionName];
        cardTopics.push({
          text: `${provisionName}: ${provisionValue}`
        });
      }
    }
    cards.push(skillsWriter.createTranscriptsCard(cardTopics, null, itlsProvisionGroup));
  }
  // The remaining provision groups next.
  const provisionGroups = Object.keys(inteleaseMetadata);
  for (let idx = 0; idx < provisionGroups.length; idx++) {
    const provisionGroupName = provisionGroups[idx];
    if (provisionGroupName === itlsProvisionGroup) {
      continue;
    }
    let cardTopics = [];
    if (inteleaseMetadata[provisionGroupName]) {
      const provisions = Object.keys(inteleaseMetadata[provisionGroupName]);
      for (let provIdx = 0; provIdx < provisions.length; provIdx++) {
        const provisionName = provisions[provIdx];
        if (inteleaseMetadata[provisionGroupName][provisionName]) {
          const provisionValue = inteleaseMetadata[provisionGroupName][provisionName];
          cardTopics.push({
            text: `${provisionName}: ${provisionValue}`
          });
        }
      }
    }
    cards.push(skillsWriter.createTranscriptsCard(cardTopics, null, provisionGroupName));
  }
  return cards;
}

/**
 * Send a simple success result.
 *
 * @param response - the response to send
 */
function sendResponse(response) {
  response.status(200).send();
}
