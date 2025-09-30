const mongoose = require('mongoose');
const { Schema } = mongoose;

const applicationSchema = new Schema({
    applicantName: { type: String, required: true },
    applicantEmail: { type: String, required: true },
    applicantAddress: { type: String, required: true },
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
    submissionDate: { type: Date, default: Date.now }
});

const Application = mongoose.model('Application', applicationSchema);
module.exports = Application;