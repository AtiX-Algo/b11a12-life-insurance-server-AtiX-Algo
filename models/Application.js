const mongoose = require('mongoose');
const { Schema } = mongoose;

const applicationSchema = new Schema({
    applicantName: { type: String, required: true },
    applicantEmail: { type: String, required: true },
    applicantAddress: { type: String, required: true },
    applicantAddress: { type: String, required: true },
    nidNumber: { type: String, required: true }, // <-- ADD THIS
    nomineeName: { type: String, required: true }, // <-- ADD THIS
    nomineeRelationship: { type: String, required: true }, // <-- ADD THIS
    healthInfo: { type: String }, // <-- ADD THIS
    policyId: { type: Schema.Types.ObjectId, ref: 'Policy', required: true },
    policyTitle: { type: String, required: true },
    coverageAmount: { type: String, required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    agentName: { type: String, default: 'Unassigned' },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    claimStatus: {  // <-- Added field
        type: String,
        enum: ['None', 'Pending', 'Approved'],
        default: 'None'
    },
    claimDetails: { // <-- Added field
        type: String,
        default: ''
    },
    rejectionFeedback: {
        type: String,
        default: ''
    },
    documentUrl: { // <-- ADD THIS
        type: String,
        default: ''
    },
    submissionDate: { type: Date, default: Date.now }
});

const Application = mongoose.model('Application', applicationSchema);
module.exports = Application;
