import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Box,
  Typography, TextField, IconButton, Checkbox, Divider, Button,
} from "@mui/material";
import { CalendarMonth, Add, DeleteOutlined } from "@mui/icons-material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { StaticDatePicker } from "@mui/x-date-pickers/StaticDatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import CancelButton from "./CancelButton";

const TaskDialog = ({ open, onClose, onTasksChange }) => {
  const [taskDate, setTaskDate] = useState(dayjs());
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");

  const loadTasksForDate = useCallback(async (date) => {
    const dateStr = date.format("YYYY-MM-DD");
    const result = await window.api.invoke("get-tasks-by-date", dateStr);
    if (result.success) setTasks(result.tasks);
  }, []);

  useEffect(() => {
    if (open) loadTasksForDate(taskDate);
  }, [open, taskDate, loadTasksForDate]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    const dateStr = taskDate.format("YYYY-MM-DD");
    await window.api.invoke("add-task", { title: newTaskTitle.trim(), description: "", taskDate: dateStr, taskTime: newTaskTime || null, reminderMinutes: 0 });
    setNewTaskTitle("");
    setNewTaskTime("");
    loadTasksForDate(taskDate);
    if (onTasksChange) onTasksChange();
  };

  const handleCompleteTask = async (taskId) => {
    await window.api.invoke("complete-task", taskId);
    loadTasksForDate(taskDate);
    if (onTasksChange) onTasksChange();
  };

  const handleDeleteTask = async (taskId) => {
    await window.api.invoke("delete-task", taskId);
    loadTasksForDate(taskDate);
    if (onTasksChange) onTasksChange();
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
                    <Checkbox size="small" checked={!!t.completed} onChange={() => handleCompleteTask(t.id)} sx={{ py: 0 }} />
                    <Typography variant="body2" sx={{ flex: 1, textDecoration: t.completed ? "line-through" : "none", color: t.completed ? "textSecondary" : "textPrimary", fontWeight: 500 }}>
                      {t.title}
                    </Typography>
                    {t.task_time && <Typography variant="caption" sx={{ color: "#64748b", minWidth: 40, textAlign: "right" }}>{t.task_time}</Typography>}
                    <IconButton size="small" onClick={() => handleDeleteTask(t.id)} sx={{ color: "#94a3b8", "&:hover": { color: "#ef4444" } }}>
                      <DeleteOutlined sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Nueva tarea</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" placeholder="Título" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                  sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: "4px" } }} />
                <TextField size="small" type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 100, "& .MuiOutlinedInput-root": { borderRadius: "4px" } }} />
                <IconButton size="small" onClick={handleAddTask} sx={{ bgcolor: "#3b82f6", color: "white", "&:hover": { bgcolor: "#2563eb" }, borderRadius: "4px" }}>
                  <Add sx={{ fontSize: 18 }} />
                </IconButton>
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
