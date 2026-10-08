import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Box,
  Typography, TextField, IconButton, Checkbox, Divider, MenuItem, Alert,
} from "@mui/material";
import {
  CalendarMonth, Add, DeleteOutlined, GroupsOutlined, PersonOutline,
} from "@mui/icons-material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { StaticDatePicker } from "@mui/x-date-pickers/StaticDatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import CancelButton from "./CancelButton";
import { useCashier } from "../contexts/CashierContext";
import useDbChanges from "../utils/useDbChanges";

const ALL = "all";

const TaskDialog = ({ open, onClose, onTasksChange }) => {
  const { cashier } = useCashier();
  const [taskDate, setTaskDate] = useState(dayjs());
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [assignee, setAssignee] = useState(ALL);
  const [titleError, setTitleError] = useState("");
  const [error, setError] = useState("");

  // Quién está viendo: el Host filtra según esto (las tareas de otros
  // usuarios no aparecen; el administrador ve todas).
  const viewer = useMemo(
    () => ({ cashierId: cashier?.id ?? null, role: cashier?.role ?? null }),
    [cashier?.id, cashier?.role],
  );
  const isAdmin = cashier?.role === "admin";

  const loadTasksForDate = useCallback(async (date) => {
    const dateStr = date.format("YYYY-MM-DD");
    const result = await window.api.invoke("get-tasks-by-date", dateStr, viewer);
    if (result?.success) setTasks(result.tasks);
  }, [viewer]);

  const loadUsers = useCallback(async () => {
    try {
      const list = await window.api.invoke("get-cashiers");
      setUsers((Array.isArray(list) ? list : []).filter((u) => u.is_active !== 0));
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadTasksForDate(taskDate);
      loadUsers();
      setError("");
    }
  }, [open, taskDate, loadTasksForDate, loadUsers]);

  // Tiempo real: tareas creadas/completadas desde otras cajas aparecen solas.
  useDbChanges(() => {
    if (open) loadTasksForDate(taskDate);
  });

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      setTitleError("Escribe qué hay que hacer");
      return;
    }
    const dateStr = taskDate.format("YYYY-MM-DD");
    const result = await window.api.invoke("add-task", {
      title: newTaskTitle.trim(),
      description: "",
      taskDate: dateStr,
      taskTime: newTaskTime || null,
      reminderMinutes: 0,
      assignedTo: assignee === ALL ? null : Number(assignee),
      createdBy: cashier?.id ?? null,
      createdByName: cashier?.name ?? null,
    });
    if (!result?.success) {
      setError(result?.error || "No se pudo guardar la tarea");
      return;
    }
    setError("");
    setTitleError("");
    setNewTaskTitle("");
    setNewTaskTime("");
    loadTasksForDate(taskDate);
    if (onTasksChange) onTasksChange();
  };

  const handleCompleteTask = async (taskId) => {
    const result = await window.api.invoke("complete-task", taskId, viewer);
    if (!result?.success) setError(result?.error || "No se pudo completar la tarea");
    loadTasksForDate(taskDate);
    if (onTasksChange) onTasksChange();
  };

  const handleDeleteTask = async (taskId) => {
    const result = await window.api.invoke("delete-task", taskId, viewer);
    if (!result?.success) setError(result?.error || "No se pudo eliminar la tarea");
    loadTasksForDate(taskDate);
    if (onTasksChange) onTasksChange();
  };

  const canManage = (t) => isAdmin || t.created_by == null || t.created_by === cashier?.id;

  const assigneeLabel = (t) => {
    if (t.assigned_to == null) return "Todos";
    if (t.assigned_to === cashier?.id) return "Para ti";
    return t.assigned_name || "Usuario eliminado";
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: "12px" } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CalendarMonth sx={{ color: "#3b82f6" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Tareas</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" onClose={() => setError("")} sx={{ mb: 1.5 }}>{error}</Alert>
        )}
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Stack direction="row" spacing={2} sx={{ minHeight: 300 }}>
            <Box sx={{ flex: "0 0 auto" }}>
              <StaticDatePicker
                displayStaticWrapperAs="desktop"
                value={taskDate}
                onChange={(newValue) => {
                  if (newValue) { setTaskDate(newValue); loadTasksForDate(newValue); }
                }}
                slotProps={{ actionBar: { actions: [] }, toolbar: { hidden: true } }}
                sx={{ "& .MuiPickersDay-root": { borderRadius: "4px" } }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Tareas del {taskDate.format("DD/MM/YYYY")}
              </Typography>
              <Stack spacing={0.5} sx={{ maxHeight: 220, overflow: "auto", mb: 1.5 }}>
                {tasks.length === 0 ? (
                  <Typography variant="body2" color="textSecondary" sx={{ fontStyle: "italic" }}>Sin tareas</Typography>
                ) : tasks.map((t) => (
                  <Box key={t.id} sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.3, px: 1, borderRadius: 1, bgcolor: t.completed ? "rgba(16,185,129,0.08)" : "transparent", "&:hover": { bgcolor: "rgba(148,163,184,0.08)" } }}>
                    <Checkbox size="small" checked={!!t.completed} disabled={!!t.completed} onChange={() => handleCompleteTask(t.id)} sx={{ py: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ textDecoration: t.completed ? "line-through" : "none", color: t.completed ? "textSecondary" : "textPrimary", fontWeight: 500 }}>
                        {t.title}
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: t.assigned_to == null ? "#64748b" : "#2563eb" }}>
                        {t.assigned_to == null
                          ? <GroupsOutlined sx={{ fontSize: 12 }} />
                          : <PersonOutline sx={{ fontSize: 12 }} />}
                        <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
                          {assigneeLabel(t)}
                          {t.created_by_name && t.created_by !== cashier?.id ? ` · de ${t.created_by_name}` : ""}
                        </Typography>
                      </Stack>
                    </Box>
                    {t.task_time && <Typography variant="caption" sx={{ color: "#64748b", minWidth: 40, textAlign: "right" }}>{t.task_time}</Typography>}
                    {canManage(t) && (
                      <IconButton size="small" onClick={() => handleDeleteTask(t.id)} sx={{ color: "#94a3b8", "&:hover": { color: "#ef4444" } }}>
                        <DeleteOutlined sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Nueva tarea</Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField size="small" required placeholder="Título" value={newTaskTitle}
                    onChange={(e) => { setNewTaskTitle(e.target.value); if (titleError) setTitleError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                    error={!!titleError} helperText={titleError}
                    sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: "4px" } }} />
                  <TextField size="small" type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 100, "& .MuiOutlinedInput-root": { borderRadius: "4px" } }} />
                  <IconButton size="small" onClick={handleAddTask} sx={{ mt: 0.5, bgcolor: "#3b82f6", color: "white", "&:hover": { bgcolor: "#2563eb" }, borderRadius: "4px" }}>
                    <Add sx={{ fontSize: 18 }} />
                  </IconButton>
                </Stack>
                <TextField select size="small" label="Asignar a" value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  helperText={assignee === ALL
                    ? "La verán y recibirán el aviso todos los usuarios"
                    : "Solo la verá y recibirá el aviso esa persona (y los administradores)"}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "4px" } }}>
                  <MenuItem value={ALL}>Todos</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} value={String(u.id)}>
                      {u.name}{u.id === cashier?.id ? " (yo)" : ""}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Box>
          </Stack>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <CancelButton onClick={onClose}>Cerrar</CancelButton>
      </DialogActions>
    </Dialog>
  );
};

export default TaskDialog;
