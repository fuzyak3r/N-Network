package sg.Chearstern;

import lombok.SneakyThrows;

import java.net.ServerSocket;
import java.net.Socket;

public class Server {
    private final ServerSocket s;

    @SneakyThrows
    public Server(int port) {
        this.s = new ServerSocket(port);
    }

    @SneakyThrows
    public void start() {
        System.out.println("Сервер стартуеться");
        while (true) {
            Socket socket = s.accept();
            Data.add(socket);
        }
    }
}
