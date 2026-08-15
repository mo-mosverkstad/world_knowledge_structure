CXX = g++
CXXFLAGS = -std=c++20 -O3 -Wall -Wextra

SRC = src/main.cpp
TARGET = main

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET)

.PHONY: all clean