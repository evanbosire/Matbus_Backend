const express = require('express');
const CommunityService = require('../models/CommunityService');
const Employee = require('../models/Employee');
const Customer = require('../models/Customer');
const router = express.Router();

// Duties Manager: Post a community service task
router.post('/tasks', async (req, res) => {
  try {
    const { title, description, employeeId } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'duties_manager') {
      return res.status(403).json({ message: 'Only duties managers can post community service tasks' });
    }
    
    const task = new CommunityService({
      title,
      description,
      postedBy: employeeId
    });
    
    await task.save();
    
    res.status(201).json({ message: 'Community service task posted successfully', task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Youth: View available community service tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await CommunityService.find({ status: 'open' })
      .populate('postedBy', 'firstName lastName');
    
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Youth: Volunteer for a task
router.post('/tasks/:taskId/volunteer', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { customerId } = req.body;
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    const task = await CommunityService.findById(taskId);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    if (task.status !== 'open') {
      return res.status(400).json({ message: 'Task is not open for volunteering' });
    }
    
    // Check if already volunteered
    const existingVolunteer = task.volunteers.find(v => v.youth.toString() === customerId);
    if (existingVolunteer) {
      return res.status(400).json({ message: 'Already volunteered for this task' });
    }
    
    task.volunteers.push({
      youth: customerId,
      status: 'pending'
    });
    
    await task.save();
    
    res.json({ message: 'Volunteered successfully. Waiting for approval.', task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Coordinator: Provide task instructions
router.put('/tasks/:taskId/instructions', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { youthId, instructions, employeeId } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'community_service_coordinator') {
      return res.status(403).json({ message: 'Only community service coordinators can provide instructions' });
    }
    
    const task = await CommunityService.findById(taskId);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if the coordinator is assigned to this task
    if (task.coordinator && task.coordinator.toString() !== employeeId) {
      return res.status(403).json({ message: 'Not authorized to provide instructions for this task' });
    }
    
    const volunteer = task.volunteers.find(v => v.youth.toString() === youthId);
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found for this task' });
    }
    
    volunteer.instructions = instructions;
    volunteer.status = 'accepted';
    
    // If coordinator not assigned, assign the current user
    if (!task.coordinator) {
      task.coordinator = employeeId;
    }
    
    task.status = 'in_progress';
    
    await task.save();
    
    res.json({ message: 'Instructions provided successfully', task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Coordinator: Mark task as completed for a youth
router.put('/tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { youthId, employeeId } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'community_service_coordinator') {
      return res.status(403).json({ message: 'Only community service coordinators can mark tasks as completed' });
    }
    
    const task = await CommunityService.findById(taskId);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if the coordinator is assigned to this task
    if (task.coordinator.toString() !== employeeId) {
      return res.status(403).json({ message: 'Not authorized to mark this task as completed' });
    }
    
    const volunteer = task.volunteers.find(v => v.youth.toString() === youthId);
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found for this task' });
    }
    
    volunteer.status = 'completed';
    volunteer.completedDate = new Date();
    
    await task.save();
    
    res.json({ message: 'Task marked as completed for the youth', task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Duties Manager: Approve completion of a task
router.put('/tasks/:taskId/approve', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { employeeId } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'duties_manager') {
      return res.status(403).json({ message: 'Only duties managers can approve task completion' });
    }
    
    const task = await CommunityService.findById(taskId);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if all volunteers have completed the task
    const allCompleted = task.volunteers.every(v => v.status === 'completed');
    if (!allCompleted) {
      return res.status(400).json({ message: 'Not all volunteers have completed the task' });
    }
    
    task.status = 'completed';
    task.completionDate = new Date();
    task.approvedBy = employeeId;
    
    await task.save();
    
    res.json({ message: 'Task completion approved successfully', task });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mentor: Guide youths on a task
router.post('/tasks/:taskId/guidance', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { guidance, employeeId } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'mentor') {
      return res.status(403).json({ message: 'Only mentors can provide guidance' });
    }
    
    const task = await CommunityService.findById(taskId)
      .populate('volunteers.youth', 'customerName email');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.json({ 
      message: 'Guidance provided successfully',
      task: task.title,
      guidance,
      volunteers: task.volunteers.map(v => v.youth.customerName)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;