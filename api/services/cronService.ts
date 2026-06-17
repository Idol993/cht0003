import cron from 'node-cron';
import { sendOverdueReminders, sendExpiredNotifications } from './notificationService';

let isRunning = false;

export function startCronJobs() {
  if (isRunning) return;
  isRunning = true;

  console.log('Starting scheduled tasks...');

  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily overdue reminder task...');
    try {
      const count = await sendOverdueReminders();
      console.log(`Sent ${count} overdue reminders`);
    } catch (error) {
      console.error('Error sending overdue reminders:', error);
    }
  });

  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily expired notification task...');
    try {
      const count = await sendExpiredNotifications();
      console.log(`Sent ${count} expired notifications`);
    } catch (error) {
      console.error('Error sending expired notifications:', error);
    }
  });

  console.log('Scheduled tasks started successfully');
}

export async function runOverdueRemindersManually(): Promise<number> {
  console.log('Running overdue reminder task manually...');
  const count = await sendOverdueReminders();
  console.log(`Sent ${count} overdue reminders`);
  return count;
}

export async function runExpiredNotificationsManually(): Promise<number> {
  console.log('Running expired notification task manually...');
  const count = await sendExpiredNotifications();
  console.log(`Sent ${count} expired notifications`);
  return count;
}
