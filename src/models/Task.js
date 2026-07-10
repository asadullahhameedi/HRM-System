const mongoose = require('mongoose');
const { Schema } = mongoose;

const TASK_PRIORITY = ['low', 'medium', 'high', 'critical'];
const TASK_STATUS = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const TASK_SCOPE = ['personal', 'team', 'department', 'project'];

const commentSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, index: 'text' },
    description: { type: String, trim: true },
    scope: { type: String, enum: TASK_SCOPE, default: 'personal', index: true },
    priority: { type: String, enum: TASK_PRIORITY, default: 'medium', index: true },
    status: { type: String, enum: TASK_STATUS, default: 'todo', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    startDate: { type: Date },
    dueDate: { type: Date, index: true },
    completedAt: { type: Date },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    labels: [{ type: String, trim: true }],
    attachments: [{ name: String, url: String }],
    comments: [commentSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ dueDate: 1, priority: 1 });

module.exports = mongoose.model('Task', taskSchema);
module.exports.TASK_PRIORITY = TASK_PRIORITY;
module.exports.TASK_STATUS = TASK_STATUS;
module.exports.TASK_SCOPE = TASK_SCOPE;
