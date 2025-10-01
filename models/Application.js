const mongoose = require('mongoose');
const { Schema } = mongoose;

const applicationSchema = new Schema({
    applicantName: { type: String, required: true },
    applicantEmail: { type: String, required: true },
    applicantAddress: { type: String, required: true },
    nidNumber: { type: String, required: true },
    phoneNumber: { type: String, required: true },    
    dateOfBirth: { type: Date, required: true },
    nomineeName: { type: String, required: true },
    nomineeRelationship: { type: String, required: true },
    nomineeContact: { type: String, required: true },
    healthDeclaration: { type: Boolean, required: true },
    termsAccepted: { type: Boolean, required: true },
    healthInfo: { type: String },
    policyId: { type: Schema.Types.ObjectId, ref: 'Policy', required: true },
    policyTitle: { type: String, required: true },
    coverageAmount: { type: String, required: true },
    estimatedPremium: { type: String },
    agentId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    agentName: { type: String, default: 'Unassigned' },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    claimStatus: {  
        type: String,
        enum: ['None', 'Pending', 'Approved'],
        default: 'None'
    },
    claimDetails: { 
        type: String,
        default: ''
    },
    rejectionFeedback: {
        type: String,
        default: ''
    },
    documentUrl: { 
        type: String,
        default: ''
    },
    submissionDate: { type: Date, default: Date.now }
});

const Application = mongoose.model('Application', applicationSchema);
module.exports = Application;
