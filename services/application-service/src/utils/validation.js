// Application status validation
export const isValidStatus = (status) => {
  const validStatuses = [
    'UNDER_REVIEW',
    'SHORTLISTED',
    'ACCEPTED',
    'REJECTED',
    'INTERVIEW',
    'WITHDRAWN'
  ];
  return validStatuses.includes(status);
};

// Middleware for validating request bodies
export const validateApplicationStatusUpdate = (req, res, next) => {
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  
  if (!isValidStatus(status)) {
    return res.status(400).json({ 
      error: 'Invalid status value',
      validValues: [
        'UNDER_REVIEW',
        'SHORTLISTED',
        'ACCEPTED',
        'REJECTED',
        'INTERVIEW',
        'WITHDRAWN'
      ]
    });
  }
  
  next();
};
