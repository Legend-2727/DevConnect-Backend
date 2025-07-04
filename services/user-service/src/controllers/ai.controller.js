// src/controllers/ai.controller.js
// import path from 'path';
// import { exec } from 'child_process';
// import db from '../db/index.js';

// export const runLangGraph = async (req, res) => {
//   const { userId } = req.params;

//   try {
//     // 1. Get CV file path from DB
//     const result = await db.query(
//       `SELECT cv_url FROM devconnect.users WHERE id = $1`,
//       [userId]
//     );

//     if (!result.rows.length) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     const relativePath = result.rows[0].cv_url.replace('/files/', '');
//     const absolutePath = path.resolve(`uploads/${relativePath}`);

//     // 2. Trigger AI service
//     const aiPath = path.resolve('../../ai-service/graph_runner.py'); // adjust if needed

//     exec(`python3 ${aiPath} ${userId} ${absolutePath}`, (err, stdout, stderr) => {
//       if (err) {
//         console.error('LangGraph error:', stderr);
//         console.error("❌ Error in AI recommendation:", err);
//         return res.status(500).json({ error: 'AI recommendation failed' });
//       }

//       try {
//         const recommendations = JSON.parse(stdout);
//         return res.status(200).json({ recommendations });
//       } catch (parseError) {
//         return res.status(500).json({ error: 'Failed to parse AI output' });
//       }
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Database error' });
//   }
// };


// // export const improveCV = async (req, res) => {
// //   const { userId } = req.params;
// //   const { role } = req.body;

// //   try {
// //     const result = await db.query(
// //       'SELECT cv_url FROM devconnect.users WHERE id = $1',
// //       [userId]
// //     );
// //     if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

// //     const relativePath = result.rows[0].cv_url.replace('/files/', '');
// //     const absolutePath = path.resolve(`uploads/${relativePath}`);
// //     const aiPath = path.resolve('../../ai-service/agent_graph/graph_runner_improve.py');

// //     exec(`python ${aiPath} ${userId} ${absolutePath} "${role}"`, (err, stdout, stderr) => {
// //       if (err) return res.status(500).json({ error: 'AI improvement failed', details: stderr });

// //       try {
// //         const output = JSON.parse(stdout);
// //         res.status(200).json({ improved_cv: output });
// //       } catch {
// //         res.status(500).json({ error: 'Failed to parse AI output' });
// //       }
// //     });
// //   } catch (err) {
// //     res.status(500).json({ error: 'Database error' });
// //   }
// // };
// export const improveCV = async (req, res) => {
//   const { userId } = req.params;
//   const { role } = req.body;

//   try {
//     const result = await db.query(
//       'SELECT cv_url FROM devconnect.users WHERE id = $1',
//       [userId]
//     );
//     if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

//     const relativePath = result.rows[0].cv_url.replace('/files/', '');
//     const absolutePath = path.resolve(`uploads/${relativePath}`);
//     const aiPath = path.resolve('../../ai-service/agent_graph/graph_runner_improve.py');

//     exec(`python3 ${aiPath} ${userId} ${absolutePath} "${role}"`, (err, stdout, stderr) => {
//       if (err) return res.status(500).json({ error: 'AI improvement failed', details: stderr });

//       try {
//         const output = JSON.parse(stdout);
//         res.status(200).json({
//           message: "CV improved successfully",
//           improved_cv_text: output.improved_cv_text,
//           customized_cv_url: output.customized_cv_url
//         });
//       } catch {
//         res.status(500).json({ error: 'Failed to parse AI output' });
//       }
//     });
//   } catch (err) {
//     res.status(500).json({ error: 'Database error' });
//   }
// };

import axios from 'axios';
import path from 'path';
import db from '../db.js';

export const runLangGraph = async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await db.query(
      `SELECT cv_url FROM devconnect.users WHERE id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const relativePath = result.rows[0].cv_url.replace('/files/', '');
    const cvPath = `/app/uploads/${relativePath}`; // Path visible to ai-service

    const response = await axios.post('http://ai-service:8000/recommend', {
      user_id: userId,
      cv_path: cvPath
    });

    return res.status(200).json({ recommendations: response.data });
  } catch (err) {
    console.error("AI service error:", err.message || err);
    return res.status(500).json({ error: 'AI recommendation failed' });
  }
};

export const improveCV = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  try {
    const result = await db.query(
      'SELECT cv_url FROM devconnect.users WHERE id = $1',
      [userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    const relativePath = result.rows[0].cv_url.replace('/files/', '');
    const absolutePath = path.resolve(`uploads/${relativePath}`);
    const aiPath = path.resolve('../../ai-service/agent_graph/graph_runner_improve.py');

    exec(`python3 ${aiPath} ${userId} ${absolutePath} "${role}"`, (err, stdout, stderr) => {
      if (err) return res.status(500).json({ error: 'AI improvement failed', details: stderr });

      try {
        const output = JSON.parse(stdout);
        res.status(200).json({
          message: "CV improved successfully",
          improved_cv_text: output.improved_cv_text,
          customized_cv_url: output.customized_cv_url
        });
      } catch {
        res.status(500).json({ error: 'Failed to parse AI output' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
};
