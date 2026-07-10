const mongoose = require('mongoose');
const { Schema } = mongoose;

const DOC_STATUS = ['draft', 'pending', 'approved', 'rejected', 'archived', 'expired'];

const documentSchema = new Schema(
  {
    docNumber: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, index: 'text' },
    type: {
      type: String,
      required: true,
      enum: [
        'employee_id_card', 'employment_certificate', 'experience_certificate',
        'salary_certificate', 'appointment_letter', 'offer_letter',
        'promotion_letter', 'warning_letter', 'relieving_letter',
        'transfer_letter', 'noc_certificate', 'internship_certificate',
        'training_certificate', 'joining_letter', 'contract_document',
        'hr_form', 'company_template', 'other',
      ],
      index: true,
    },
    category: { type: String, trim: true },
    description: { type: String, trim: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', index: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    status: { type: String, enum: DOC_STATUS, default: 'draft', index: true },
    issuedDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    version: { type: Number, default: 1 },
    previousVersion: { type: Schema.Types.ObjectId, ref: 'Document' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

documentSchema.index({ type: 1, status: 1 });
documentSchema.index({ employee: 1, type: 1 });

module.exports = mongoose.model('Document', documentSchema);
module.exports.DOC_STATUS = DOC_STATUS;
