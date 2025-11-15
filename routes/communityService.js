// const express = require('express');
// const CommunityService = require('../models/CommunityService');
// const Employee = require('../models/Employee');
// const Customer = require('../models/Customer');
// const router = express.Router();
// // Get Coordinator Employee
// // GET all employees with role 'Community Service Coordinator'
// router.get('/employees/coordinators', async (req, res) => {
//   try {
//     // Fetch employees where the role matches (case-insensitive)
//     const coordinators = await Employee.find({
//       role: { $regex: /^community service coordinator$/i }
//     }).select('firstName lastName email phoneNumber role');

//     // Check if any coordinators exist
//     if (coordinators.length === 0) {
//       return res.status(404).json({ message: 'No community service coordinators found.' });
//     }

//     // Return list of coordinators
//     res.status(200).json({
//       message: 'Community service coordinators fetched successfully.',
//       count: coordinators.length,
//       coordinators
//     });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error retrieving coordinators.', error: error.message });
//   }
// });
// // Duties Manager — Post a Task
// router.post('/tasks', async (req, res) => {
//   try {
//     const { title, description, location, startDate, endDate, employeeId, coordinatorId } = req.body;

//     const manager = await Employee.findById(employeeId);
//     if (!manager || manager.role !== 'Duties manager') {
//       return res.status(403).json({ message: 'Only duties managers can post tasks.' });
//     }

//     const coordinator = await Employee.findById(coordinatorId);
//     if (!coordinator || coordinator.role !== 'Community Service Coordinator') {
//       return res.status(400).json({ message: 'Invalid coordinator ID.' });
//     }

//     const task = new CommunityService({
//       title, description, location, startDate, endDate,
//       postedBy: employeeId,
//       coordinator: coordinatorId
//     });

//     await task.save();
//     res.status(201).json({ message: 'Community service task created successfully.', task });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Duties Manager — Approve Task Completion
// router.put('/tasks/:taskId/approve', async (req, res) => {
//   try {
//     const { taskId } = req.params;
//     const { employeeId } = req.body;

//     const manager = await Employee.findById(employeeId);
//     if (!manager || manager.role.toLowerCase() !== 'Duties manager') {
//       return res.status(403).json({ message: 'Only duties managers can approve tasks.' });
//     }

//     const task = await CommunityService.findById(taskId);
//     if (!task) return res.status(404).json({ message: 'Task not found.' });

//     const allCompleted = task.volunteers.every(v => v.status === 'completed');
//     if (!allCompleted) {
//       return res.status(400).json({ message: 'All volunteers must complete their tasks first.' });
//     }

//     task.status = 'completed';
//     task.completionDate = new Date();
//     task.approvedBy = employeeId;

//     await task.save();
//     res.json({ message: 'Task completion approved successfully.', task });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Youth — View All Open Tasks
// router.get('/tasks', async (req, res) => {
//   try {
//     const tasks = await CommunityService.find({ status: 'open' })
//       .populate('postedBy', 'firstName lastName role')
//       .populate('coordinator', 'firstName lastName role');
//     res.json(tasks);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Youth — Volunteer for a Task
// router.post('/tasks/:taskId/volunteer', async (req, res) => {
//   try {
//     const { taskId } = req.params;
//     const { customerId } = req.body;

//     const customer = await Customer.findById(customerId);
//     if (!customer) return res.status(404).json({ message: 'Youth not found.' });

//     const task = await CommunityService.findById(taskId);
//     if (!task) return res.status(404).json({ message: 'Task not found.' });
//     if (task.status !== 'open') return res.status(400).json({ message: 'Task is not open for volunteering.' });

//     const alreadyVolunteered = task.volunteers.some(v => v.youth.toString() === customerId);
//     if (alreadyVolunteered) return res.status(400).json({ message: 'Already volunteered.' });

//     task.volunteers.push({ youth: customerId });
//     await task.save();

//     res.json({ message: 'Volunteer registration submitted. Await coordinator approval.', task });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Coordinator — Approve or Reject Volunteer
// router.put('/tasks/:taskId/volunteer/:volunteerId/status', async (req, res) => {
//   try {
//     const { taskId, volunteerId } = req.params;
//     const { employeeId, status, instructions } = req.body;

//     const coordinator = await Employee.findById(employeeId);
//     if (!coordinator || coordinator.role !== 'Community Service Coordinator') {
//       return res.status(403).json({ message: 'Only coordinators can update volunteer status.' });
//     }

//     const task = await CommunityService.findById(taskId);
//     if (!task || task.coordinator.toString() !== employeeId) {
//       return res.status(403).json({ message: 'Not authorized for this task.' });
//     }

//     const volunteer = task.volunteers.id(volunteerId);
//     if (!volunteer) return res.status(404).json({ message: 'Volunteer not found.' });

//     volunteer.status = status;
//     if (instructions) volunteer.instructions = instructions;

//     if (status === 'accepted') task.status = 'in_progress';

//     await task.save();
//     res.json({ message: `Volunteer ${status} successfully.`, task });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Coordinator — Mark Individual Volunteer as Completed
// router.put('/tasks/:taskId/volunteer/:volunteerId/complete', async (req, res) => {
//   try {
//     const { taskId, volunteerId } = req.params;
//     const { employeeId } = req.body;

//     const coordinator = await Employee.findById(employeeId);
//     if (!coordinator || coordinator.role !== 'Community Service Coordinator') {
//       return res.status(403).json({ message: 'Only coordinators can mark tasks as completed.' });
//     }

//     const task = await CommunityService.findById(taskId);
//     if (!task || task.coordinator.toString() !== employeeId) {
//       return res.status(403).json({ message: 'Not authorized for this task.' });
//     }

//     const volunteer = task.volunteers.id(volunteerId);
//     if (!volunteer) return res.status(404).json({ message: 'Volunteer not found.' });

//     volunteer.status = 'completed';
//     volunteer.completedDate = new Date();

//     await task.save();
//     res.json({ message: 'Volunteer marked as completed.', task });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });


// module.exports = router;

const express = require('express');
const CommunityService = require('../models/CommunityService');
const Employee = require('../models/Employee');
const Customer = require('../models/Customer');
const router = express.Router();

/* ============================================================
   1. GET ALL COORDINATORS
============================================================ */
router.get('/employees/coordinators', async (req, res) => {
  try {
    const coordinators = await Employee.find({
      role: { $regex: /^community service coordinator$/i }
    }).select('firstName lastName email phoneNumber role');

    if (coordinators.length === 0) {
      return res.status(404).json({ message: 'No community service coordinators found.' });
    }

    res.status(200).json({
      message: 'Community service coordinators fetched successfully.',
      count: coordinators.length,
      coordinators
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   2. DUTIES MANAGER — POST TASK
============================================================ */
router.post('/tasks', async (req, res) => {
  try {
    const { title, description, location, startDate, endDate, employeeId, coordinatorId } = req.body;

    const manager = await Employee.findById(employeeId);
    if (!manager || manager.role !== 'Duties manager') {
      return res.status(403).json({ message: 'Only duties managers can post tasks.' });
    }

    const coordinator = await Employee.findById(coordinatorId);
    if (!coordinator || coordinator.role !== 'Community Service Coordinator') {
      return res.status(400).json({ message: 'Invalid coordinator ID.' });
    }

    const task = new CommunityService({
      title, description, location, startDate, endDate,
      postedBy: employeeId,
      coordinator: coordinatorId
    });

    await task.save();
    res.status(201).json({ message: 'Community service task created successfully.', task });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   3. DUTIES MANAGER — GET ALL TASKS THEY POSTED
============================================================ */
router.get('/manager/:managerId/tasks', async (req, res) => {
  try {
    const { managerId } = req.params;

    const tasks = await CommunityService.find({ postedBy: managerId })
      .populate('coordinator', 'firstName lastName role');

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* ============================================================
   4. DUTIES MANAGER — GET TASKS AWAITING APPROVAL
============================================================ */
router.get('/manager/:managerId/tasks/pending-approval', async (req, res) => {
  try {
    const { managerId } = req.params;

    const tasks = await CommunityService.find({
      postedBy: managerId,
      status: 'in_progress'
    });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   5. DUTIES MANAGER — APPROVE FINAL TASK COMPLETION
============================================================ */
router.put('/tasks/:taskId/approve', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { employeeId } = req.body;

    const manager = await Employee.findById(employeeId);
    if (!manager || manager.role !== 'Duties manager') {
      return res.status(403).json({ message: 'Only duties managers can approve tasks.' });
    }

    const task = await CommunityService.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const allCompleted = task.volunteers.every(v => v.status === 'completed');
    if (!allCompleted) {
      return res.status(400).json({ message: 'All volunteers must complete their tasks first.' });
    }

    task.status = 'completed';
    task.completionDate = new Date();
    task.approvedBy = employeeId;

    await task.save();
    res.json({ message: 'Task completion approved successfully.', task });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   6. YOUTH — VIEW ALL OPEN TASKS
============================================================ */
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await CommunityService.find({ status: 'open' })
      .populate('postedBy', 'firstName lastName role')
      .populate('coordinator', 'firstName lastName role');

    res.json(tasks);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   7. YOUTH — VOLUNTEER FOR A TASK
============================================================ */
router.post('/tasks/:taskId/volunteer', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { customerId } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ message: 'Youth not found.' });

    const task = await CommunityService.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (task.status !== 'open') return res.status(400).json({ message: 'Task is not open for volunteering.' });

    const already = task.volunteers.some(v => v.youth.toString() === customerId);
    if (already) return res.status(400).json({ message: 'Already volunteered.' });

    task.volunteers.push({ youth: customerId });
    await task.save();

    res.json({ message: 'Volunteer registration submitted. Await coordinator approval.', task });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   8. YOUTH — VIEW ALL TASKS THEY VOLUNTEERED FOR
============================================================ */
router.get('/youth/:youthId/tasks', async (req, res) => {
  try {
    const { youthId } = req.params;

    const tasks = await CommunityService.find({
      'volunteers.youth': youthId
    }).select('title location startDate endDate volunteers status');

    res.json(tasks);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   9. COORDINATOR — GET ALL TASKS ASSIGNED TO THEM
============================================================ */
router.get('/coordinator/:coordId/tasks', async (req, res) => {
  try {
    const { coordId } = req.params;

    const tasks = await CommunityService.find({ coordinator: coordId })
      .populate('postedBy', 'firstName lastName role');

    res.json(tasks);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   10. COORDINATOR — GET ALL VOLUNTEERS FOR A TASK
============================================================ */
router.get('/tasks/:taskId/volunteers', async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await CommunityService.findById(taskId)
      .populate('volunteers.youth', 'firstName lastName email');

    if (!task) return res.status(404).json({ message: 'Task not found.' });

    res.json(task.volunteers);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   11. COORDINATOR — APPROVE/REJECT VOLUNTEER
============================================================ */
router.put('/tasks/:taskId/volunteer/:volunteerId/status', async (req, res) => {
  try {
    const { taskId, volunteerId } = req.params;
    const { employeeId, status, instructions } = req.body;

    const coordinator = await Employee.findById(employeeId);
    if (!coordinator || coordinator.role !== 'Community Service Coordinator') {
      return res.status(403).json({ message: 'Only coordinators can update volunteer status.' });
    }

    const task = await CommunityService.findById(taskId);
    if (!task || task.coordinator.toString() !== employeeId) {
      return res.status(403).json({ message: 'Not authorized for this task.' });
    }

    const volunteer = task.volunteers.id(volunteerId);
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found.' });

    volunteer.status = status;
    if (instructions) volunteer.instructions = instructions;

    if (status === 'accepted') task.status = 'in_progress';

    await task.save();

    res.json({ message: `Volunteer ${status} successfully.`, task });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   12. COORDINATOR — MARK VOLUNTEER AS COMPLETED
============================================================ */
router.put('/tasks/:taskId/volunteer/:volunteerId/complete', async (req, res) => {
  try {
    const { taskId, volunteerId } = req.params;
    const { employeeId } = req.body;

    const coordinator = await Employee.findById(employeeId);
    if (!coordinator || coordinator.role !== 'Community Service Coordinator') {
      return res.status(403).json({ message: 'Only coordinators can mark tasks as completed.' });
    }

    const task = await CommunityService.findById(taskId);
    if (!task || task.coordinator.toString() !== employeeId) {
      return res.status(403).json({ message: 'Not authorized for this task.' });
    }

    const volunteer = task.volunteers.id(volunteerId);
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found.' });

    volunteer.status = 'completed';
    volunteer.completedDate = new Date();

    await task.save();

    res.json({ message: 'Volunteer marked as completed.', task });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* ============================================================
   13. COORDINATOR — VIEW COMPLETED VOLUNTEERS
============================================================ */
router.get('/tasks/:taskId/completed-volunteers', async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await CommunityService.findById(taskId)
      .populate('volunteers.youth', 'firstName lastName email');

    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const completed = task.volunteers.filter(v => v.status === 'completed');

    res.json(completed);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
