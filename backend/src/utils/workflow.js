// Allowed status transitions (anything else is rejected with HTTP 400).
const TRANSITIONS = {
  open: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['resolved', 'assigned'],
  resolved: ['closed', 'in_progress'],
  closed: []
};

// Which transitions each role may perform (on top of the transition map).
const ROLE_TRANSITIONS = {
  admin: null, // any valid transition
  agent: ['assigned>in_progress', 'in_progress>resolved', 'in_progress>assigned', 'resolved>in_progress'],
  employee: ['resolved>closed', 'resolved>in_progress'] // confirm or reopen own request
};

// Default SLA (hours until due) by priority.
const SLA_HOURS = { critical: 4, high: 24, medium: 72, low: 120 };

const STATUSES = Object.keys(TRANSITIONS);
const PRIORITIES = Object.keys(SLA_HOURS);
const STATUS_LABELS = {
  open: 'Open', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed'
};

const isValidTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

// Can this user move this request from `from` to `to`?
function canUserTransition(user, request, to) {
  if (!isValidTransition(request.status, to)) return false;
  if (to === 'assigned' && !request.assigned_to) return false;
  const key = `${request.status}>${to}`;
  if (user.role === 'admin') return true;
  if (user.role === 'agent') {
    return request.assigned_to === user.id && ROLE_TRANSITIONS.agent.includes(key);
  }
  if (user.role === 'employee') {
    return request.created_by === user.id && ROLE_TRANSITIONS.employee.includes(key);
  }
  return false;
}

const allowedTransitions = (user, request) =>
  (TRANSITIONS[request.status] || []).filter((to) => canUserTransition(user, request, to));

const dueDateFor = (priority, from = new Date()) =>
  new Date(from.getTime() + SLA_HOURS[priority] * 3600 * 1000);

module.exports = {
  TRANSITIONS, SLA_HOURS, STATUSES, PRIORITIES, STATUS_LABELS,
  isValidTransition, canUserTransition, allowedTransitions, dueDateFor
};
