import axios from 'axios';
import * as uuid from 'uuid';

export const handler = async () => {
  await axios.put(process.env.SIGNAL_URL!, {
    Status: 'SUCCESS',
    Reason: 'RootMail Setup completed',
    UniqueId: uuid.v4(),
    Data: 'RootMail Setup completed',
  });

  // TODO remove event rule trigger
};
