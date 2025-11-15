const mongoose = require('mongoose');

const financeSchema = new mongoose.Schema({
  totalDonations: {
    type: Number,
    default: 0,
    required: true
  },
  currentBalance: {
    type: Number,
    default: 0,
    required: true
  },
  totalExpenses: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  donationCount: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  monthlyBreakdown: [{
    year: {
      type: Number,
      required: true
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    donations: {
      type: Number,
      default: 0
    },
    expenses: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    }
  }],
  donationRecords: [{
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    status: {
      type: String,
      enum: ['recorded', 'processed'],
      default: 'recorded'
    }
  }],
  expenseRecords: [{
    description: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    category: {
      type: String,
      enum: ['operational', 'program', 'administrative', 'other'],
      default: 'operational'
    },
    date: {
      type: Date,
      default: Date.now
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    receiptUrl: String
  }]
}, {
  timestamps: true
});

// Static method to get or create finance record
financeSchema.statics.getFinanceRecord = async function() {
  let finance = await this.findOne();
  if (!finance) {
    finance = await this.create({});
  }
  return finance;
};

// Method to update finance when donation is approved
financeSchema.methods.addDonation = async function(donationId, amount, donorId) {
  this.totalDonations += amount;
  this.currentBalance += amount;
  this.totalRevenue += amount;
  this.donationCount += 1;
  
  // Add to donation records
  this.donationRecords.push({
    donationId,
    amount,
    donor: donorId,
    status: 'recorded'
  });
  
  // Update monthly breakdown
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  let monthlyRecord = this.monthlyBreakdown.find(
    record => record.year === year && record.month === month
  );
  
  if (!monthlyRecord) {
    monthlyRecord = { year, month, donations: 0, expenses: 0, revenue: 0 };
    this.monthlyBreakdown.push(monthlyRecord);
  }
  
  monthlyRecord.donations += amount;
  monthlyRecord.revenue += amount;
  
  this.lastUpdated = new Date();
  return this.save();
};

// Method to add expense
financeSchema.methods.addExpense = async function(description, amount, category, approvedBy, receiptUrl) {
  this.totalExpenses += amount;
  this.currentBalance -= amount;
  
  this.expenseRecords.push({
    description,
    amount,
    category,
    approvedBy,
    receiptUrl
  });
  
  // Update monthly breakdown
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  let monthlyRecord = this.monthlyBreakdown.find(
    record => record.year === year && record.month === month
  );
  
  if (!monthlyRecord) {
    monthlyRecord = { year, month, donations: 0, expenses: 0, revenue: 0 };
    this.monthlyBreakdown.push(monthlyRecord);
  }
  
  monthlyRecord.expenses += amount;
  
  this.lastUpdated = new Date();
  return this.save();
};

// Method to get financial summary
financeSchema.methods.getSummary = function() {
  return {
    totalDonations: this.totalDonations,
    currentBalance: this.currentBalance,
    totalExpenses: this.totalExpenses,
    totalRevenue: this.totalRevenue,
    donationCount: this.donationCount,
    netProfit: this.totalRevenue - this.totalExpenses
  };
};

// Virtual for current month stats
financeSchema.virtual('currentMonthStats').get(function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  const monthlyRecord = this.monthlyBreakdown.find(
    record => record.year === year && record.month === month
  );
  
  return monthlyRecord || { year, month, donations: 0, expenses: 0, revenue: 0 };
});

// Index for better query performance
financeSchema.index({ lastUpdated: -1 });
financeSchema.index({ 'monthlyBreakdown.year': 1, 'monthlyBreakdown.month': 1 });

module.exports = mongoose.model('Finance', financeSchema);